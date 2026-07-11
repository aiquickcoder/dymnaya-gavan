// Package webpush delivers Web Push notifications to browser subscriptions
// (CRM as PWA / tab). VAPID (RFC 8292) auth + message encryption (RFC 8291,
// aes128gcm per RFC 8188), built on the Go stdlib only.
package webpush

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"math/big"
	"net/http"
	"net/url"
	"strings"
	"time"
)

var b64 = base64.RawURLEncoding

// Subscription is a browser Web Push subscription.
type Subscription struct {
	Endpoint string
	P256dh   string // base64url uncompressed UA public key (65 bytes)
	Auth     string // base64url auth secret (16 bytes)
}

// Notification is the JSON payload the service worker receives.
type Notification struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	URL   string `json:"url,omitempty"`
	Tag   string `json:"tag,omitempty"`
}

// Sender signs (VAPID) and encrypts (aes128gcm) Web Push messages.
type Sender struct {
	vapidPriv   *ecdsa.PrivateKey
	vapidPubB64 string
	subject     string
	client      *http.Client
}

// NewSender builds a Sender from base64url VAPID keys. subject is a mailto:/https contact.
func NewSender(pubB64, privB64, subject string) (*Sender, error) {
	dBytes, err := b64.DecodeString(strings.TrimSpace(privB64))
	if err != nil {
		return nil, fmt.Errorf("vapid private key: %w", err)
	}
	priv := new(ecdsa.PrivateKey)
	priv.Curve = elliptic.P256()
	priv.D = new(big.Int).SetBytes(dBytes)
	priv.PublicKey.X, priv.PublicKey.Y = elliptic.P256().ScalarBaseMult(dBytes)
	if subject == "" {
		subject = "mailto:onboarding@hookahmania.ru"
	}
	return &Sender{
		vapidPriv:   priv,
		vapidPubB64: strings.TrimSpace(pubB64),
		subject:     subject,
		client:      &http.Client{Timeout: 10 * time.Second},
	}, nil
}

// PublicKey returns the base64url VAPID application server key for the frontend.
func (s *Sender) PublicKey() string { return s.vapidPubB64 }

// Send encrypts n for sub and POSTs it to the push endpoint. Returns the HTTP status.
func (s *Sender) Send(ctx context.Context, sub Subscription, n Notification) (int, error) {
	payload, _ := json.Marshal(n)
	body, err := encrypt(sub, payload)
	if err != nil {
		return 0, err
	}
	auth, err := s.vapidHeader(sub.Endpoint)
	if err != nil {
		return 0, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, sub.Endpoint, bytes.NewReader(body))
	if err != nil {
		return 0, err
	}
	req.Header.Set("Content-Encoding", "aes128gcm")
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("TTL", "600")
	req.Header.Set("Urgency", "high")
	req.Header.Set("Authorization", auth)
	resp, err := s.client.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	return resp.StatusCode, nil
}

// vapidHeader builds the "vapid t=<jwt>, k=<pub>" Authorization header for the endpoint origin.
func (s *Sender) vapidHeader(endpoint string) (string, error) {
	u, err := url.Parse(endpoint)
	if err != nil {
		return "", err
	}
	aud := u.Scheme + "://" + u.Host
	header := b64.EncodeToString([]byte(`{"typ":"JWT","alg":"ES256"}`))
	claims, _ := json.Marshal(map[string]any{
		"aud": aud,
		"exp": time.Now().Add(12 * time.Hour).Unix(),
		"sub": s.subject,
	})
	signingInput := header + "." + b64.EncodeToString(claims)
	h := sha256.Sum256([]byte(signingInput))
	r, ss, err := ecdsa.Sign(rand.Reader, s.vapidPriv, h[:])
	if err != nil {
		return "", err
	}
	sig := make([]byte, 64)
	r.FillBytes(sig[:32])
	ss.FillBytes(sig[32:])
	jwt := signingInput + "." + b64.EncodeToString(sig)
	return "vapid t=" + jwt + ", k=" + s.vapidPubB64, nil
}

// encrypt implements RFC 8291 message encryption with the aes128gcm content coding (RFC 8188).
func encrypt(sub Subscription, plaintext []byte) ([]byte, error) {
	uaPubBytes, err := b64.DecodeString(sub.P256dh)
	if err != nil {
		return nil, fmt.Errorf("p256dh: %w", err)
	}
	authSecret, err := b64.DecodeString(sub.Auth)
	if err != nil {
		return nil, fmt.Errorf("auth: %w", err)
	}
	curve := ecdh.P256()
	uaPub, err := curve.NewPublicKey(uaPubBytes)
	if err != nil {
		return nil, fmt.Errorf("ua public key: %w", err)
	}
	asPriv, err := curve.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	asPubBytes := asPriv.PublicKey().Bytes() // 65-byte uncompressed point
	shared, err := asPriv.ECDH(uaPub)
	if err != nil {
		return nil, err
	}

	// IKM = HKDF(salt=auth, ikm=ecdh, info="WebPush: info\0"||uaPub||asPub, 32)
	keyInfo := append([]byte("WebPush: info\x00"), uaPubBytes...)
	keyInfo = append(keyInfo, asPubBytes...)
	ikm, err := hkdf.Key(sha256.New, shared, authSecret, string(keyInfo), 32)
	if err != nil {
		return nil, err
	}

	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return nil, err
	}
	cek, err := hkdf.Key(sha256.New, ikm, salt, "Content-Encoding: aes128gcm\x00", 16)
	if err != nil {
		return nil, err
	}
	nonce, err := hkdf.Key(sha256.New, ikm, salt, "Content-Encoding: nonce\x00", 12)
	if err != nil {
		return nil, err
	}

	block, err := aes.NewCipher(cek)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	record := make([]byte, 0, len(plaintext)+1)
	record = append(record, plaintext...)
	record = append(record, 0x02) // single-record padding delimiter (RFC 8188)
	ciphertext := gcm.Seal(nil, nonce, record, nil)

	// aes128gcm header (RFC 8188 §2.1): salt(16) | rs(4) | idlen(1) | keyid(asPub) | ciphertext
	var buf bytes.Buffer
	buf.Write(salt)
	rs := make([]byte, 4)
	binary.BigEndian.PutUint32(rs, 4096)
	buf.Write(rs)
	buf.WriteByte(byte(len(asPubBytes)))
	buf.Write(asPubBytes)
	buf.Write(ciphertext)
	return buf.Bytes(), nil
}
