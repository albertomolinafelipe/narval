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
	BannerImage    string `json:"banner_image"`  // URL of the banner image
	ProductLinks   string `json:"product_links"` // JSON: {"web":"...","ios":"...","android":"..."}
	Founders       string `json:"founders"`      // JSON: [{"name":"...","photo_url":"...","linkedin":"..."}]

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

	OwnerID      string    `gorm:"not null;index"                 json:"owner_id"`
	OwnerEmail   string    `gorm:"not null"                       json:"owner_email"`
	ProfileSetup bool      `gorm:"default:false"                  json:"profile_setup"`
	Verified     bool      `gorm:"default:false"                  json:"verified"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

// BeforeCreate sets a UUID primary key when none is provided.
func (s *Startup) BeforeCreate(tx *gorm.DB) error {
	if s.ID == "" {
		s.ID = uuid.NewString()
	}
	return nil
}
