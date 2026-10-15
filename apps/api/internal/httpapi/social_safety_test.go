package httpapi

import "testing"

func TestValidReportReason_AllAccepted(t *testing.T) {
	accepted := []string{"spam", "harassment", "hate", "violence", "sexual", "misinformation", "other"}
	for _, r := range accepted {
		if !validReportReason(r) {
			t.Errorf("expected reason %q to be accepted", r)
		}
	}
}

func TestValidReportReason_Rejected(t *testing.T) {
	rejected := []string{
		"", " ", "SPAM", "Harassment", "unknown", "fraud",
		"spam ", " spam", "spam\n", "other\x00",
		"'; DROP TABLE BaiDang;--",
	}
	for _, r := range rejected {
		if validReportReason(r) {
			t.Errorf("expected reason %q to be rejected", r)
		}
	}
}

func TestValidReportReason_ExactCount(t *testing.T) {
	count := 0
	for range reportReasons {
		count++
	}
	if count != 7 {
		t.Fatalf("expected 7 report reasons, got %d", count)
	}
}
