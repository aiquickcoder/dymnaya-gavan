package push

import (
	"bytes"
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"encoding/pem"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"sync"
	"time"
)

// serviceAccount is the subset of a Google service-account JSON we need to mint
// an OAuth2 access token for FCM HTTP v1.
type serviceAccount struct {
	ClientEmail string `json:"client_email"`
	PrivateKey  string `json:"private_key"`
	TokenURI    string `json:"token_uri"`
	ProjectID   string `json:"project_id"`
}

// FCMSender sends pushes via FCM HTTP v1. Access tokens are minted from the
// service-account key with the standard library only (no external SDK) and cached
// until near expiry.
type FCMSender struct {
	projectID string
	sa        serviceAccount
	key       *rsa.PrivateKey
	http      *http.Client

	mu    sync.Mutex
	token string
	exp   time.Time
}

// NewFCM loads a service-account JSON file and prepares an FCM v1 sender.
// projectID overrides the one in the file when non-empty.
func NewFCM(credentialsFile, projectID string) (*FCMSender, error) {
	raw, err := os.ReadFile(credentialsFile)
	if err != nil {
		return nil, fmt.Errorf("read fcm credentials: %w", err)
	}
	var sa serviceAccount
	if err := json.Unmarshal(raw, &sa); err != nil {
		return nil, fmt.Errorf("parse fcm credentials: %w", err)
	}
	if sa.TokenURI == "" {
		sa.TokenURI = "https://oauth2.googleapis.com/token"
	}
	key, err := parseRSAKey(sa.PrivateKey)
	if err != nil {
		return nil, err
	}
	if projectID == "" {
		projectID = sa.ProjectID
	}
	if projectID == "" {
		return nil, fmt.Errorf("fcm: project id is empty")
	}
	return &FCMSender{projectID: projectID, sa: sa, key: key, http: &http.Client{Timeout: 10 * time.Second}}, nil
}

func parseRSAKey(pemStr string) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode([]byte(pemStr))
	if block == nil {
		return nil, fmt.Errorf("fcm: invalid private key PEM")
	}
	if k, err := x509.ParsePKCS8PrivateKey(block.Bytes); err == nil {
		if rk, ok := k.(*rsa.PrivateKey); ok {
			return rk, nil
		}
		return nil, fmt.Errorf("fcm: private key is not RSA")
	}
	if rk, err := x509.ParsePKCS1PrivateKey(block.Bytes); err == nil {
		return rk, nil
	}
	return nil, fmt.Errorf("fcm: cannot parse private key")
}

// accessToken returns a cached OAuth2 token, refreshing it when near expiry.
func (f *FCMSender) accessToken(ctx context.Context) (string, error) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.token != "" && time.Now().Before(f.exp.Add(-1*time.Minute)) {
		return f.token, nil
	}
	now := time.Now()
	claims := map[string]any{
		"iss":   f.sa.ClientEmail,
		"scope": "https://www.googleapis.com/auth/firebase.messaging",
		"aud":   f.sa.TokenURI,
		"iat":   now.Unix(),
		"exp":   now.Add(time.Hour).Unix(),
	}
	assertion, err := signJWT(claims, f.key)
	if err != nil {
		return "", err
	}
	form := url.Values{}
	form.Set("grant_type", "urn:ietf:params:oauth:grant-type:jwt-bearer")
	form.Set("assertion", assertion)
	req, _ := http.NewRequestWithContext(ctx, http.MethodPost, f.sa.TokenURI, strings.NewReader(form.Encode()))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := f.http.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("fcm token: %s: %s", resp.Status, body)
	}
	var tok struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.Unmarshal(body, &tok); err != nil {
		return "", err
	}
	f.token = tok.AccessToken
	f.exp = now.Add(time.Duration(tok.ExpiresIn) * time.Second)
	return f.token, nil
}

// signJWT builds and RS256-signs a JWT for the OAuth2 jwt-bearer flow.
func signJWT(claims map[string]any, key *rsa.PrivateKey) (string, error) {
	header, _ := json.Marshal(map[string]string{"alg": "RS256", "typ": "JWT"})
	payload, _ := json.Marshal(claims)
	signing := base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(payload)
	digest := sha256.Sum256([]byte(signing))
	sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
	if err != nil {
		return "", err
	}
	return signing + "." + base64.RawURLEncoding.EncodeToString(sig), nil
}

// SendCall delivers the notification to each token (FCM v1 is one message per
// token). Returns the first error encountered but attempts all tokens.
func (f *FCMSender) SendCall(ctx context.Context, tokens []string, n CallNotification) error {
	if len(tokens) == 0 {
		return nil
	}
	at, err := f.accessToken(ctx)
	if err != nil {
		return err
	}
	endpoint := "https://fcm.googleapis.com/v1/projects/" + f.projectID + "/messages:send"
	var firstErr error
	for _, t := range tokens {
		msg := map[string]any{"message": map[string]any{
			"token":        t,
			"notification": map[string]any{"title": Title(n.TableID), "body": Body(n.Type)},
			"data": map[string]string{
				"callId":       n.CallID,
				"restaurantId": n.RestaurantID,
				"tableId":      n.TableID,
				"type":         n.Type,
			},
			"android": map[string]any{
				"priority":     "high",
				"notification": map[string]any{"channel_id": "calls", "sound": "default"},
			},
			"apns": map[string]any{
				"headers": map[string]string{"apns-priority": "10"},
				"payload": map[string]any{"aps": map[string]any{"sound": "default"}},
			},
		}}
		b, _ := json.Marshal(msg)
		req, _ := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(b))
		req.Header.Set("Authorization", "Bearer "+at)
		req.Header.Set("Content-Type", "application/json")
		resp, err := f.http.Do(req)
		if err != nil {
			if firstErr == nil {
				firstErr = err
			}
			continue
		}
		if resp.StatusCode >= http.StatusMultipleChoices {
			rb, _ := io.ReadAll(resp.Body)
			if firstErr == nil {
				firstErr = fmt.Errorf("fcm send %s: %s", resp.Status, rb)
			}
		}
		resp.Body.Close()
	}
	return firstErr
}
