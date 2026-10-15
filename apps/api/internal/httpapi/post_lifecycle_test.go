package httpapi

import "testing"

func TestValidVisibilityValues(t *testing.T) {
	tests := []struct {
		v  string
		ok bool
	}{
		{"public", true},
		{"followers", true},
		{"private", true},
		{"", false},
		{"Public", false},
		{"FOLLOWERS", false},
		{"unlisted", false},
		{" public", false},
		{"public ", false},
		{"admin", false},
	}
	for _, tc := range tests {
		t.Run(tc.v, func(t *testing.T) {
			if validVisibility(tc.v) != tc.ok {
				t.Fatalf("validVisibility(%q) = %v; want %v", tc.v, !tc.ok, tc.ok)
			}
		})
	}
}
