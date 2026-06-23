package auth

// publicEmailDomains lists common free/personal email providers.
// Used to block non-company domains from the verified registration path.
var publicEmailDomains = map[string]bool{
	"gmail.com": true, "googlemail.com": true,
	"yahoo.com": true, "yahoo.co.uk": true, "yahoo.es": true, "yahoo.fr": true, "yahoo.de": true,
	"hotmail.com": true, "hotmail.co.uk": true, "hotmail.es": true, "hotmail.fr": true,
	"outlook.com": true, "outlook.es": true, "outlook.fr": true,
	"live.com": true, "live.co.uk": true,
	"icloud.com": true, "me.com": true, "mac.com": true,
	"protonmail.com": true, "proton.me": true,
	"aol.com":  true,
	"mail.com": true, "email.com": true,
	"zoho.com":   true,
	"yandex.com": true, "yandex.ru": true,
	"gmx.com": true, "gmx.de": true,
	"tutanota.com": true, "tuta.com": true,
	"fastmail.com": true,
	"hey.com":      true,
	"pm.me":        true,
	"msn.com":      true,
	"inbox.com":    true,
}

func isPublicEmailDomain(domain string) bool {
	return publicEmailDomains[domain]
}
