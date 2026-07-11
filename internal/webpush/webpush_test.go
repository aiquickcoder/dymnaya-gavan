package webpush

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"testing"
)

// TestEncryptRoundTrip verifies the server-side RFC 8291 encryption decrypts on
// the UA side (what a browser does), proving CEK/nonce/IKM derivation is correct.
func TestEncryptRoundTrip(t *testing.T) {
	curve := ecdh.P256()
	uaPriv, err := curve.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	uaPubBytes := uaPriv.PublicKey().Bytes()
	auth := make([]byte, 16)
	if _, err := rand.Read(auth); err != nil {
		t.Fatal(err)
	}

	sub := Subscription{
		Endpoint: "https://example.com/push/abc",
		P256dh:   b64.EncodeToString(uaPubBytes),
		Auth:     b64.EncodeToString(auth),
	}
	plaintext := []byte(`{"title":"Стол 7 · VIP","body":"Гость зовёт мастера","url":"/admin/calls"}`)

	body, err := encrypt(sub, plaintext)
	if err != nil {
		t.Fatalf("encrypt: %v", err)
	}

	// Parse aes128gcm header: salt(16) | rs(4) | idlen(1) | keyid(asPub) | ciphertext
	if len(body) < 21 {
		t.Fatalf("body too short: %d", len(body))
	}
	salt := body[0:16]
	rs := binary.BigEndian.Uint32(body[16:20])
	if rs != 4096 {
		t.Fatalf("rs = %d, want 4096", rs)
	}
	idlen := int(body[20])
	if idlen != 65 {
		t.Fatalf("idlen = %d, want 65", idlen)
	}
	asPubBytes := body[21 : 21+idlen]
	ciphertext := body[21+idlen:]

	asPub, err := curve.NewPublicKey(asPubBytes)
	if err != nil {
		t.Fatalf("as public key: %v", err)
	}
	shared, err := uaPriv.ECDH(asPub)
	if err != nil {
		t.Fatalf("ecdh: %v", err)
	}

	keyInfo := append([]byte("WebPush: info\x00"), uaPubBytes...)
	keyInfo = append(keyInfo, asPubBytes...)
	ikm, err := hkdf.Key(sha256.New, shared, auth, string(keyInfo), 32)
	if err != nil {
		t.Fatal(err)
	}
	cek, err := hkdf.Key(sha256.New, ikm, salt, "Content-Encoding: aes128gcm\x00", 16)
	if err != nil {
		t.Fatal(err)
	}
	nonce, err := hkdf.Key(sha256.New, ikm, salt, "Content-Encoding: nonce\x00", 12)
	if err != nil {
		t.Fatal(err)
	}

	block, err := aes.NewCipher(cek)
	if err != nil {
		t.Fatal(err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		t.Fatal(err)
	}
	record, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		t.Fatalf("decrypt: %v", err)
	}
	record = bytes.TrimRight(record, "\x02")
	if !bytes.Equal(record, plaintext) {
		t.Fatalf("round-trip mismatch:\n got  %q\n want %q", record, plaintext)
	}
}

// TestVapidHeader sanity-checks the VAPID Authorization header shape.
func TestVapidHeader(t *testing.T) {
	// dev-only throwaway keypair
	s, err := NewSender(
		"BA0Hin0MBiLFp0myMMkB7q6cusAT-4KDSiMVQ33Hd8GHtOdj_85-jHgt0TI8aEk_POXiClne2gJV1efAVJkWM9M",
		"TtGjqI8F8VRu2MjebzziYHgR1TCHMiIF4BJl4ISJrqc",
		"mailto:test@example.com",
	)
	if err != nil {
		t.Fatal(err)
	}
	h, err := s.vapidHeader("https://fcm.googleapis.com/fcm/send/abc")
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.HasPrefix([]byte(h), []byte("vapid t=")) {
		t.Fatalf("bad header prefix: %q", h)
	}
	if !bytes.Contains([]byte(h), []byte(", k=")) {
		t.Fatalf("missing k= in header: %q", h)
	}
}
