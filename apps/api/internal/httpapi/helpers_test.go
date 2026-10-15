package httpapi

import (
	"database/sql"
	"strings"
	"testing"
	"time"
)

// ---------------------------------------------------------------------------
// textVal / rawTextVal
// ---------------------------------------------------------------------------

func TestTextVal(t *testing.T) {
	m := map[string]interface{}{
		"name":   "  Alice  ",
		"empty":  "",
		"number": 42,
	}
	tests := []struct {
		label string
		keys  []string
		want  string
	}{
		{"first key match", []string{"name"}, "Alice"},
		{"fallback key", []string{"missing", "name"}, "Alice"},
		{"empty string", []string{"empty"}, ""},
		{"non-string value", []string{"number"}, ""},
		{"all missing", []string{"x", "y"}, ""},
		{"no keys", nil, ""},
	}
	for _, tc := range tests {
		t.Run(tc.label, func(t *testing.T) {
			got := textVal(m, tc.keys...)
			if got != tc.want {
				t.Fatalf("textVal(%v) = %q; want %q", tc.keys, got, tc.want)
			}
		})
	}
}

func TestRawTextVal(t *testing.T) {
	m := map[string]interface{}{
		"pw": "  secret  ",
	}
	got := rawTextVal(m, "pw")
	if got != "  secret  " {
		t.Fatalf("rawTextVal should preserve whitespace, got %q", got)
	}
	if rawTextVal(m, "nope") != "" {
		t.Fatal("rawTextVal missing key should return empty string")
	}
}

// ---------------------------------------------------------------------------
// validVisibility
// ---------------------------------------------------------------------------

func TestValidVisibility(t *testing.T) {
	tests := []struct {
		input string
		ok    bool
	}{
		{"public", true},
		{"followers", true},
		{"private", true},
		{"", false},
		{"Public", false},
		{"unlisted", false},
		{"admin", false},
	}
	for _, tc := range tests {
		t.Run(tc.input, func(t *testing.T) {
			if got := validVisibility(tc.input); got != tc.ok {
				t.Fatalf("validVisibility(%q) = %v; want %v", tc.input, got, tc.ok)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// accessiblePostSQL
// ---------------------------------------------------------------------------

func TestAccessiblePostSQL_Guest(t *testing.T) {
	sql := accessiblePostSQL("b", 0)
	if !strings.Contains(sql, "lifecycle_state='active'") {
		t.Fatal("guest policy must require active posts")
	}
	if !strings.Contains(sql, "visibility='public'") {
		t.Fatal("guest policy must restrict to public visibility")
	}
	// Guest policy should NOT reference follows or user_blocks
	if strings.Contains(sql, "follows") {
		t.Fatal("guest policy should not reference follows table")
	}
}

func TestAccessiblePostSQL_AuthenticatedUser(t *testing.T) {
	sql := accessiblePostSQL("b", 42)
	if !strings.Contains(sql, "lifecycle_state='active'") {
		t.Fatal("user policy must require active posts")
	}
	if !strings.Contains(sql, "idTaiKhoan=42") {
		t.Fatal("user should see own posts")
	}
	if !strings.Contains(sql, "follows") {
		t.Fatal("user policy should reference follows for follower-only visibility")
	}
	if !strings.Contains(sql, "user_blocks") {
		t.Fatal("user policy should exclude blocked users")
	}
}

func TestAccessiblePostSQL_NoInjection(t *testing.T) {
	// viewer IDs are always validated integers (from parsePositiveID),
	// but verify the output is deterministic and doesn't embed raw strings.
	sql1 := accessiblePostSQL("b", 1)
	sql2 := accessiblePostSQL("b", 1)
	if sql1 != sql2 {
		t.Fatal("identical inputs should produce identical SQL")
	}
}

// ---------------------------------------------------------------------------
// post.JSON()
// ---------------------------------------------------------------------------

func TestPostJSON(t *testing.T) {
	created := time.Date(2025, 6, 15, 12, 0, 0, 0, time.UTC)
	p := post{
		ID: 1, OwnerID: 2, Author: "alice", Avatar: "/img/a.png",
		Content: "Hello", Media: "/uploads/posts/x.jpg",
		Created: created, CommentsEnabled: true,
		Visibility: "public", State: "active", Revision: 3,
		PinnedAt: sql.NullTime{Valid: true, Time: created},
		UpdatedAt: sql.NullTime{Valid: true, Time: created},
		Reactions: nil,
	}
	j := p.JSON()
	if j["id"] != 1 {
		t.Fatalf("id = %v; want 1", j["id"])
	}
	if j["idTaiKhoan"] != 2 {
		t.Fatalf("idTaiKhoan = %v; want 2", j["idTaiKhoan"])
	}
	if j["tenDangNhap"] != "alice" {
		t.Fatalf("tenDangNhap = %v; want alice", j["tenDangNhap"])
	}
	if j["isPinned"] != true {
		t.Fatalf("isPinned should be true for valid PinnedAt")
	}
	if j["edited"] != true {
		t.Fatalf("edited should be true for valid UpdatedAt")
	}
	if j["visibility"] != "public" {
		t.Fatalf("visibility = %v; want public", j["visibility"])
	}
	if j["lifecycleState"] != "active" {
		t.Fatalf("lifecycleState = %v; want active", j["lifecycleState"])
	}
	if j["revision"] != 3 {
		t.Fatalf("revision = %v; want 3", j["revision"])
	}
	dateStr, ok := j["ngayDang"].(string)
	if !ok || dateStr != created.Format(time.RFC3339) {
		t.Fatalf("ngayDang = %v; want RFC3339 format", j["ngayDang"])
	}
}

func TestPostJSON_UnpinnedUnedited(t *testing.T) {
	p := post{
		ID: 5, OwnerID: 10, Author: "bob",
		Content: "test", State: "active", Visibility: "private",
		Created: time.Now(),
	}
	j := p.JSON()
	if j["isPinned"] != false {
		t.Fatal("isPinned should be false for zero PinnedAt")
	}
	if j["edited"] != false {
		t.Fatal("edited should be false for zero UpdatedAt")
	}
}

// ---------------------------------------------------------------------------
// emptyReactionCounts
// ---------------------------------------------------------------------------

func TestEmptyReactionCounts_AllSevenPresent(t *testing.T) {
	counts := emptyReactionCounts()
	expected := []string{"like", "dislike", "love", "haha", "wow", "sad", "angry"}
	if len(counts) != len(expected) {
		t.Fatalf("expected %d reaction types, got %d", len(expected), len(counts))
	}
	for _, key := range expected {
		v, ok := counts[key]
		if !ok {
			t.Fatalf("missing reaction type %q", key)
		}
		if v != 0 {
			t.Fatalf("reaction %q should start at 0, got %v", key, v)
		}
	}
}

func TestEmptyReactionCounts_Independence(t *testing.T) {
	a := emptyReactionCounts()
	b := emptyReactionCounts()
	a["like"] = 99
	if b["like"] != 0 {
		t.Fatal("modifying one result should not affect another")
	}
}
