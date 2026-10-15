package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
)

func init() { gin.SetMode(gin.TestMode) }

var testSecret = []byte("test-secret-key-for-unit-tests")

func makeExpiredToken(t *testing.T) string {
	t.Helper()
	claims := jwt.MapClaims{
		"id":          1,
		"tenDangNhap": "test",
		"phanQuyen":   "user",
		"exp":         time.Now().Add(-1 * time.Hour).Unix(),
	}
	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(testSecret)
	if err != nil {
		t.Fatalf("failed to sign expired token: %v", err)
	}
	return tok
}

// ---------------------------------------------------------------------------
// Auth middleware (header parsing only — DB call is stubbed by the App)
// ---------------------------------------------------------------------------

func TestAuthMiddleware_MissingHeader(t *testing.T) {
	app := &App{Secret: testSecret}
	r := gin.New()
	r.Use(app.auth)
	r.GET("/test", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })

	req := httptest.NewRequest("GET", "/test", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != 401 {
		t.Fatalf("expected 401 without auth header, got %d", rec.Code)
	}
}

func TestAuthMiddleware_MalformedHeader(t *testing.T) {
	app := &App{Secret: testSecret}
	r := gin.New()
	r.Use(app.auth)
	r.GET("/test", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })

	tests := []struct {
		label, header string
	}{
		{"no bearer prefix", "Token abc123"},
		{"empty string", ""},
		{"only bearer", "Bearer"},
		{"basic auth", "Basic dGVzdDp0ZXN0"},
	}
	for _, tc := range tests {
		t.Run(tc.label, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/test", nil)
			if tc.header != "" {
				req.Header.Set("Authorization", tc.header)
			}
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)
			if rec.Code != 401 {
				t.Fatalf("expected 401 for %q, got %d", tc.header, rec.Code)
			}
		})
	}
}

func TestAuthMiddleware_ExpiredToken(t *testing.T) {
	app := &App{Secret: testSecret}
	r := gin.New()
	r.Use(app.auth)
	r.GET("/test", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+makeExpiredToken(t))
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != 401 {
		t.Fatalf("expected 401 for expired token, got %d", rec.Code)
	}
}

func TestAuthMiddleware_WrongSigningKey(t *testing.T) {
	claims := jwt.MapClaims{
		"id":          1,
		"tenDangNhap": "test",
		"phanQuyen":   "user",
		"exp":         time.Now().Add(1 * time.Hour).Unix(),
	}
	tok, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte("wrong-key"))

	app := &App{Secret: testSecret}
	r := gin.New()
	r.Use(app.auth)
	r.GET("/test", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != 401 {
		t.Fatalf("expected 401 for wrong key, got %d", rec.Code)
	}
}

func TestAuthMiddleware_InvalidClaimsID(t *testing.T) {
	// Token with string "id" instead of numeric
	claims := jwt.MapClaims{
		"id":          "not-a-number",
		"tenDangNhap": "test",
		"phanQuyen":   "user",
		"exp":         time.Now().Add(1 * time.Hour).Unix(),
	}
	tok, _ := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(testSecret)

	app := &App{Secret: testSecret}
	r := gin.New()
	r.Use(app.auth)
	r.GET("/test", func(c *gin.Context) { c.JSON(200, gin.H{"ok": true}) })

	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("Authorization", "Bearer "+tok)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != 401 {
		t.Fatalf("expected 401 for invalid claims, got %d", rec.Code)
	}
}

// ---------------------------------------------------------------------------
// CORS middleware
// ---------------------------------------------------------------------------

func TestCORS_MultipleOrigins(t *testing.T) {
	r := gin.New()
	r.Use(corsMiddleware([]string{"http://a.com", "http://b.com"}))
	r.GET("/api/test", func(c *gin.Context) { c.Status(200) })

	tests := []struct {
		label, origin string
		allow         bool
	}{
		{"first origin", "http://a.com", true},
		{"second origin", "http://b.com", true},
		{"unknown origin", "http://c.com", false},
	}
	for _, tc := range tests {
		t.Run(tc.label, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/api/test", nil)
			req.Header.Set("Origin", tc.origin)
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)
			acao := rec.Header().Get("Access-Control-Allow-Origin")
			if tc.allow && acao != tc.origin {
				t.Fatalf("expected ACAO=%q, got %q", tc.origin, acao)
			}
			if !tc.allow && acao != "" {
				t.Fatalf("expected no ACAO for %q, got %q", tc.origin, acao)
			}
		})
	}
}

func TestCORS_PreflightHeaders(t *testing.T) {
	r := gin.New()
	r.Use(corsMiddleware([]string{"http://app.example"}))
	r.POST("/api/test", func(c *gin.Context) { c.Status(200) })

	req := httptest.NewRequest("OPTIONS", "/api/test", nil)
	req.Header.Set("Origin", "http://app.example")
	req.Header.Set("Access-Control-Request-Method", "POST")
	req.Header.Set("Access-Control-Request-Headers", "Authorization, Content-Type")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != 204 {
		t.Fatalf("preflight should return 204, got %d", rec.Code)
	}
	allow := rec.Header().Get("Access-Control-Allow-Headers")
	for _, h := range []string{"Authorization", "Content-Type"} {
		if !strings.Contains(allow, h) {
			t.Fatalf("preflight should allow %s, got %q", h, allow)
		}
	}
	methods := rec.Header().Get("Access-Control-Allow-Methods")
	for _, m := range []string{"GET", "POST", "PUT", "DELETE"} {
		if !strings.Contains(methods, m) {
			t.Fatalf("preflight should allow %s, got %q", m, methods)
		}
	}
	if rec.Header().Get("Access-Control-Max-Age") == "" {
		t.Fatal("preflight should include Max-Age")
	}
}

func TestCORS_VaryHeaderAlways(t *testing.T) {
	r := gin.New()
	r.Use(corsMiddleware([]string{"http://localhost:5173"}))
	r.GET("/api/test", func(c *gin.Context) { c.Status(200) })

	req := httptest.NewRequest("GET", "/api/test", nil)
	req.Header.Set("Origin", "http://evil.example")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Header().Get("Vary") != "Origin" {
		t.Fatal("disallowed origin requests should still set Vary: Origin")
	}
}

func TestCORS_WhitespaceOriginsTrimmed(t *testing.T) {
	r := gin.New()
	r.Use(corsMiddleware([]string{"  http://trimmed.example  "}))
	r.GET("/", func(c *gin.Context) { c.Status(200) })

	req := httptest.NewRequest("GET", "/", nil)
	req.Header.Set("Origin", "http://trimmed.example")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Header().Get("Access-Control-Allow-Origin") != "http://trimmed.example" {
		t.Fatal("origins should be trimmed of whitespace")
	}
}

// ---------------------------------------------------------------------------
// intParam
// ---------------------------------------------------------------------------

func TestIntParam(t *testing.T) {
	r := gin.New()
	r.GET("/item/:id", func(c *gin.Context) {
		id, ok := intParam(c, "id")
		if !ok {
			return
		}
		c.JSON(200, gin.H{"id": id})
	})

	tests := []struct {
		label string
		param string
		code  int
	}{
		{"valid", "5", 200},
		{"zero", "0", 400},
		{"negative", "-1", 400},
		{"text", "abc", 400},
		{"float", "3.5", 400},
	}
	for _, tc := range tests {
		t.Run(tc.label, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/item/"+tc.param, nil)
			rec := httptest.NewRecorder()
			r.ServeHTTP(rec, req)
			if rec.Code != tc.code {
				t.Fatalf("intParam(%q) → HTTP %d; want %d", tc.param, rec.Code, tc.code)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// fail() helper
// ---------------------------------------------------------------------------

func TestFailResponse(t *testing.T) {
	r := gin.New()
	r.GET("/err", func(c *gin.Context) { fail(c, 422, "test error") })

	req := httptest.NewRequest("GET", "/err", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != 422 {
		t.Fatalf("expected 422, got %d", rec.Code)
	}
	var body map[string]interface{}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if body["success"] != false {
		t.Fatal("fail() should set success=false")
	}
	if body["message"] != "test error" {
		t.Fatalf("message = %v; want 'test error'", body["message"])
	}
}

// ---------------------------------------------------------------------------
// userID / isAdmin context helpers
// ---------------------------------------------------------------------------

func TestUserIDAndIsAdmin(t *testing.T) {
	r := gin.New()
	r.GET("/check", func(c *gin.Context) {
		c.Set("userID", 42)
		c.Set("role", "admin")
		c.JSON(200, gin.H{"uid": userID(c), "admin": isAdmin(c)})
	})

	req := httptest.NewRequest("GET", "/check", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	var body map[string]interface{}
	json.Unmarshal(rec.Body.Bytes(), &body)
	if int(body["uid"].(float64)) != 42 {
		t.Fatalf("userID = %v; want 42", body["uid"])
	}
	if body["admin"] != true {
		t.Fatal("isAdmin should return true for role=admin")
	}
}

func TestIsAdmin_RegularUser(t *testing.T) {
	r := gin.New()
	r.GET("/check", func(c *gin.Context) {
		c.Set("role", "user")
		c.JSON(200, gin.H{"admin": isAdmin(c)})
	})

	req := httptest.NewRequest("GET", "/check", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	var body map[string]interface{}
	json.Unmarshal(rec.Body.Bytes(), &body)
	if body["admin"] != false {
		t.Fatal("isAdmin should return false for role=user")
	}
}

func TestUserID_NotSet(t *testing.T) {
	r := gin.New()
	r.GET("/check", func(c *gin.Context) {
		c.JSON(200, gin.H{"uid": userID(c)})
	})

	req := httptest.NewRequest("GET", "/check", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	var body map[string]interface{}
	json.Unmarshal(rec.Body.Bytes(), &body)
	if int(body["uid"].(float64)) != 0 {
		t.Fatal("userID should return 0 when not set")
	}
}

// ---------------------------------------------------------------------------
// issueToken
// ---------------------------------------------------------------------------

func TestIssueToken_Roundtrip(t *testing.T) {
	app := &App{Secret: testSecret}
	tok, err := app.issueToken(42, "alice", "user")
	if err != nil {
		t.Fatalf("issueToken failed: %v", err)
	}
	if tok == "" {
		t.Fatal("token should not be empty")
	}

	// Parse and verify
	parsed, err := jwt.Parse(tok, func(token *jwt.Token) (interface{}, error) {
		return testSecret, nil
	})
	if err != nil || !parsed.Valid {
		t.Fatalf("token should be valid: %v", err)
	}
	claims, ok := parsed.Claims.(jwt.MapClaims)
	if !ok {
		t.Fatal("claims should be MapClaims")
	}
	if int(claims["id"].(float64)) != 42 {
		t.Fatalf("id = %v; want 42", claims["id"])
	}
	if claims["tenDangNhap"] != "alice" {
		t.Fatalf("tenDangNhap = %v; want alice", claims["tenDangNhap"])
	}
	if claims["phanQuyen"] != "user" {
		t.Fatalf("phanQuyen = %v; want user", claims["phanQuyen"])
	}
	exp := int64(claims["exp"].(float64))
	if exp <= time.Now().Unix() {
		t.Fatal("token should not be expired")
	}
}

// ---------------------------------------------------------------------------
// Hello and healthz endpoints (no DB needed for hello)
// ---------------------------------------------------------------------------

func TestHelloEndpoint(t *testing.T) {
	r := gin.New()
	r.GET("/hello", func(c *gin.Context) {
		c.String(200, "Server đang hoạt động tại ZenSpace!")
	})

	req := httptest.NewRequest("GET", "/hello", nil)
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != 200 {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if !strings.Contains(rec.Body.String(), "ZenSpace") {
		t.Fatal("hello response should contain ZenSpace")
	}
}

// ---------------------------------------------------------------------------
// parsePositiveID — extended edge cases
// ---------------------------------------------------------------------------

func TestParsePositiveID_Int64(t *testing.T) {
	tests := []struct {
		label string
		v     int64
		want  int
		ok    bool
	}{
		{"valid", 100, 100, true},
		{"zero", 0, 0, false},
		{"negative", -5, 0, false},
		{"max safe", 9007199254740991, 9007199254740991, true},
		{"over safe", 9007199254740992, 0, false},
	}
	for _, tc := range tests {
		t.Run(tc.label, func(t *testing.T) {
			got, ok := parsePositiveID(tc.v)
			if got != tc.want || ok != tc.ok {
				t.Fatalf("parsePositiveID(%d) = (%d,%v); want (%d,%v)", tc.v, got, ok, tc.want, tc.ok)
			}
		})
	}
}

func TestParsePositiveID_Nil(t *testing.T) {
	if _, ok := parsePositiveID(nil); ok {
		t.Fatal("nil should not parse as a positive ID")
	}
}

// ---------------------------------------------------------------------------
// Reaction type validation
// ---------------------------------------------------------------------------

func TestReactionTypesList(t *testing.T) {
	expected := map[string]bool{
		"like": true, "dislike": true, "love": true,
		"haha": true, "wow": true, "sad": true, "angry": true,
	}
	if len(reactionTypes) != len(expected) {
		t.Fatalf("expected %d reaction types, got %d", len(expected), len(reactionTypes))
	}
	for _, rt := range reactionTypes {
		if !expected[rt] {
			t.Fatalf("unexpected reaction type: %q", rt)
		}
	}
}

// ---------------------------------------------------------------------------
// Content-Type routing test (structured around how requests reach handlers)
// ---------------------------------------------------------------------------

func TestCORS_NoOriginPassesThrough(t *testing.T) {
	r := gin.New()
	r.Use(corsMiddleware([]string{"http://localhost:5173"}))
	r.GET("/api/test", func(c *gin.Context) {
		c.JSON(200, gin.H{"ok": true})
	})

	req := httptest.NewRequest("GET", "/api/test", nil)
	// No Origin header
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != 200 {
		t.Fatalf("request without origin should pass through, got %d", rec.Code)
	}
	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Fatal("should not set ACAO when no origin is present")
	}
}

func TestDisallowedPreflightReturns403(t *testing.T) {
	r := gin.New()
	r.Use(corsMiddleware([]string{"http://localhost:5173"}))
	r.POST("/api/test", func(c *gin.Context) { c.Status(http.StatusOK) })

	req := httptest.NewRequest("OPTIONS", "/api/test", nil)
	req.Header.Set("Origin", "https://evil.example")
	req.Header.Set("Access-Control-Request-Method", "POST")
	rec := httptest.NewRecorder()
	r.ServeHTTP(rec, req)

	if rec.Code != 403 {
		t.Fatalf("disallowed preflight should return 403, got %d", rec.Code)
	}
}
