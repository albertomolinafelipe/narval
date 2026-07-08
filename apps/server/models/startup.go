package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Startup account on the platform.
type Startup struct {
	ID          string `gorm:"type:uuid;primaryKey"          json:"id"`
	Name        string `gorm:"not null;uniqueIndex"           json:"name"`
	Tagline     string `json:"tagline"`
	Description string `gorm:"type:text"                      json:"description"`
	About       string `gorm:"type:text"                      json:"about"`      // long-form markdown pitch (Overview tab)
	VideoURL    string `json:"video_url"`                                        // YouTube URL embedded on Overview tab
	Milestones  string `gorm:"type:text"                      json:"milestones"` // JSON: {"items":[{"text","link","category"}],"achieved":n}
	Website     string `json:"website"`
	// VerifiedDomain is set only at verified registration and is never updatable
	// by the owner. Empty for non-verified startups.
	VerifiedDomain string `json:"verified_domain"`
	LogoURL        string `json:"logo_url"`
	Stage          string `json:"stage"`
	Industry       string `json:"industry"`
	TeamSize       int    `json:"team_size"`
	Location       string `json:"location"`
	FoundedYear    int    `json:"founded_year"`
	TechStack      string `json:"tech_stack"`
	BannerImage    string `json:"banner_image"`              // URL of the banner image
	ProductLinks   string `json:"product_links"`             // JSON: {"web":"...","ios":"...","android":"..."}
	Founders       string `json:"founders"`                  // JSON: [{"name":"...","photo_url":"...","linkedin":"..."}]
	Gallery        string `gorm:"type:text" json:"gallery"`  // JSON: ["url1","url2",…] vertical product screenshots (max 4)
	ProductStatus  string `json:"product_status"`            // coming-soon | waitlist | beta | live (empty = none)
	Features       string `gorm:"type:text" json:"features"` // JSON: [{"title":"...","description":"..."}] key product features (max 8)

	// Socials — explicit columns
	Linkedin  string `json:"linkedin"`
	Twitter   string `json:"twitter"`
	Github    string `json:"github"`
	Instagram string `json:"instagram"`

	// Funding
	IsRaising    bool   `json:"is_raising"`
	CurrentRound string `json:"current_round"` // pre-seed | seed | series-a | series-b | bridge
	FundingAsk   string `json:"funding_ask"`   // e.g. "€500k", "€1M–€2M"
	FundingUse   string `gorm:"type:text" json:"funding_use"`

	// Talent
	IsHiring  bool   `json:"is_hiring"`
	OpenRoles string `json:"open_roles"` // comma list

	// Contributing (markdown)
	ContributingText string `gorm:"type:text" json:"contributing_text"`

	// Contact
	ContactGeneral string `json:"contact_general"`
	ContactFunding string `json:"contact_funding"`
	ContactTalent  string `json:"contact_talent"`

	OwnerID      string `gorm:"not null;index"                 json:"owner_id"`
	OwnerEmail   string `gorm:"not null"                       json:"owner_email"`
	ProfileSetup bool   `gorm:"default:false"                  json:"profile_setup"`
	Verified     bool   `gorm:"default:false"                  json:"verified"`

	// InstagramVerified is set once an admin confirms the DM challenge for the
	// current Instagram handle. Read-only to the owner: it is cleared whenever the
	// handle is edited or an admin resets the verification.
	InstagramVerified bool `gorm:"default:false"           json:"instagram_verified"`

	// Claimed is true for every real profile (normal registration + already
	// handed-off shells). Admin-seeded shells start false. Completed shells
	// (profile_setup = true) are publicly listed even before they are claimed —
	// deliberate, so the directory has content pre-launch; only the claim
	// machinery (ClaimToken) stays hidden. The "one profile per owner" rule is
	// enforced in the claim/registration paths (accounts.bindClaim,
	// CreateStartup), not by a DB constraint.
	Claimed bool `gorm:"default:false"                       json:"claimed"`
	// ClaimToken is the bearer secret in the claim link; non-empty only while a
	// shell is unclaimed, burned on claim. Never serialised in API responses.
	ClaimToken string `json:"-"`

	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// BeforeCreate sets a UUID primary key when none is provided.
func (s *Startup) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.NewString()
	}
	return nil
}
