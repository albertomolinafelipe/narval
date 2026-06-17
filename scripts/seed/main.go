package main

import (
	"bytes"
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/google/uuid"
	"github.com/joho/godotenv"
	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"
	"github.com/narval/server/models"
	"github.com/schollz/progressbar/v3"
	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type startupSeed struct {
	Name           string
	Tagline        string
	Description    string
	Website        string
	LogoURL        string
	Industry       string
	Stage          string
	Location       string
	FoundedYear    int
	TeamSize       int
	IsRaising      bool
	CurrentRound   string
	FundingAsk     string
	IsHiring       bool
	OpenRoles      string
	Linkedin       string
	Twitter        string
	Github         string
	Instagram      string
	ProductIos     string
	ProductAndroid string
	ContactEmail   string
	BannerURL      string
}

var startups = []startupSeed{
	{
		Name:        "Factorial",
		Tagline:     "The business software to manage your whole team",
		Description: "Factorial is an AI-powered workforce operations platform that helps SMBs automate and centralise HR, payroll, time tracking, talent, and expenses in one place. Used by over 16,000 companies across 10+ countries, Factorial cuts administrative overhead by up to 60% and lets teams focus on higher-impact work. Founded in Barcelona in 2016, the company reached unicorn status in 2022 and has raised over $220M to date.",
		Website:     "factorialhr.com",
		LogoURL:     "https://cdn.brandfetch.io/idWW1ep1M3/w/400/h/400/theme/dark/icon.jpeg?c=1bxid64Mup7aczewSAYMX",
		Industry:    "HR Tech",
		Stage:       "growth",
		Location:    "Barcelona, Spain",
		FoundedYear: 2016,
		TeamSize:    500,
		IsRaising:   false,
		IsHiring:    true,
		OpenRoles:   "Software Engineer, Sales Executive, Product Manager",
		Linkedin:    "factorialhr",
		// Twitter:        "factorialhr",
		Github:         "factorialco",
		Instagram:      "factorial",
		ProductIos:     "https://apps.apple.com/us/app/factorial/id1479184236",
		ProductAndroid: "https://play.google.com/store/apps/details?id=com.factorialhr.factorialapp",
		ContactEmail:   "hello@factorialhr.com",
		BannerURL:      "https://factorialhr.com/images/factorial-open-graph.png",
	},
	{
		Name:        "Glovo",
		Tagline:     "Anything you want, delivered in minutes",
		Description: "Glovo is a Barcelona-born on-demand delivery platform connecting customers with local businesses and couriers to deliver food, groceries, pharmaceuticals, and everyday essentials. Founded in 2015, Glovo has surpassed 1 billion orders and operates across 25+ countries in Europe, Africa, and Central Asia. The platform generates over €1 billion in yearly turnover from its quick-commerce business alone and employs over 3,000 people globally, alongside a network of 100,000+ couriers.",
		Website:     "glovoapp.com",
		LogoURL:     "https://play-lh.googleusercontent.com/iTpx7rDQGJQd4dHVwhsKmSpQv72zyJ6M4df8smHO7rGCOJUKeKZtynrft0NWlnf47w=w240-h480",
		Industry:    "Marketplace",
		Stage:       "growth",
		Location:    "Barcelona, Spain",
		FoundedYear: 2015,
		TeamSize:    3000,
		IsRaising:   false,
		IsHiring:    true,
		OpenRoles:   "Software Engineer, Data Scientist, Operations Manager",
		Linkedin:    "glovo-app",
		// Twitter:        "glovo_es",
		Github:         "glovo",
		Instagram:      "glovo_es",
		ProductIos:     "https://apps.apple.com/us/app/glovo-food-delivery-takeaway/id951812684",
		ProductAndroid: "https://play.google.com/store/apps/details?id=com.glovo",
		ContactEmail:   "press@glovoapp.com",
		BannerURL:      "https://mir-s3-cdn-cf.behance.net/project_modules/fs/1711bd124720563.610a2d8ab1330.png",
	},
	{
		Name:         "Typeform",
		Tagline:      "Build forms people actually enjoy filling out",
		Description:  "Typeform is a Barcelona-based SaaS company that transforms the way businesses collect data through conversational, one-question-at-a-time forms and surveys. Founded in 2012, Typeform serves over 150,000 paying customers including Apple, Airbnb, and Uber. The platform achieved $141M in annual revenue in 2024 and is valued at $935M following its $135M Series C. Typeform's no-code interface makes it accessible to teams across marketing, product, research, and HR.",
		Website:      "typeform.com",
		LogoURL:      "https://cdn.brandfetch.io/idPkJ70vyb/w/200/h/200/theme/dark/icon.jpeg?c=1bxid64Mup7aczewSAYMX",
		Industry:     "SaaS",
		Stage:        "growth",
		Location:     "Barcelona, Spain",
		FoundedYear:  2012,
		TeamSize:     400,
		IsRaising:    false,
		IsHiring:     true,
		OpenRoles:    "Backend Engineer, Product Designer, Growth Marketer",
		Linkedin:     "typeform",
		Twitter:      "typeform-",
		Github:       "typeform",
		Instagram:    "typeform",
		ContactEmail: "hello@typeform.com",
		BannerURL:    "https://cdn.prod.website-files.com/66ffe2174aa8e8d5661c2708/6889ccfec828e151ddd96537_ogimage.png",
	},
	{
		Name:        "TravelPerk",
		Tagline:     "The all-in-one platform for business travel",
		Description: "TravelPerk is a Barcelona-headquartered business travel management platform that lets companies book, manage, and report on all their travel in one place. Founded in 2015, TravelPerk reached EBITDA break-even in 2024 with over €2.4B in annualised booking volume and €192M in annualised revenue. The company employs 1,200+ people across 35 nationalities and raised a €192M Series E in 2025 led by Atomico and EQT, bringing total funding to over $715M at a $2.7B valuation.",
		Website:     "travelperk.com",
		LogoURL:     "https://cdn.brandfetch.io/idfHsX0Fqw/w/400/h/400/theme/dark/icon.jpeg?c=1bxid64Mup7aczewSAYMX",
		Industry:    "SaaS",
		Stage:       "growth",
		Location:    "Barcelona, Spain",
		FoundedYear: 2015,
		TeamSize:    1200,
		IsRaising:   false,
		IsHiring:    true,
		OpenRoles:   "Sales Executive, Full-Stack Engineer, UX Designer",
		Linkedin:    "travelperk",
		// Twitter:        "travelperk",
		Github:         "travelperk",
		Instagram:      "perk.global",
		ProductIos:     "https://apps.apple.com/us/app/perk/id1472369913",
		ProductAndroid: "https://play.google.com/store/apps/details?id=com.travelperk",
		ContactEmail:   "hello@travelperk.com",
		BannerURL:      "https://a.storyblok.com/f/287723338557348/1920x1080/6a3f2bc85b/brand-overview-static.jpg",
	},
	{
		Name:           "Wallapop",
		Tagline:        "Buy and sell second-hand, sustainably",
		Description:    "Wallapop is Barcelona's leading peer-to-peer marketplace for second-hand goods, connecting millions of buyers and sellers across Spain and beyond. Founded in 2013, the platform hosts over 80 million product listings across fashion, electronics, home, and collectibles. Wallapop has raised over $191M including a 2021 Series D led by Korelya Capital and is one of the fastest-growing sustainable commerce platforms in Southern Europe.",
		Website:        "wallapop.com",
		LogoURL:        "https://play-lh.googleusercontent.com/uykj6t0svCeUYDUEG1osUlslAhb3aFQNzPrbKibBv5cZDH_ZdjiwVWsrQFt_pXUdbYw=w240-h480",
		Industry:       "Marketplace",
		Stage:          "growth",
		Location:       "Barcelona, Spain",
		FoundedYear:    2013,
		TeamSize:       500,
		IsRaising:      false,
		IsHiring:       true,
		OpenRoles:      "Data Scientist, Mobile Engineer, Product Manager",
		Linkedin:       "wallapop",
		Twitter:        "wallapop",
		Github:         "wallapop",
		Instagram:      "wallapop",
		ProductIos:     "https://apps.apple.com/es/app/wallapop-vende-y-compra/id692753615",
		ProductAndroid: "https://play.google.com/store/apps/details?id=com.wallapop",
		ContactEmail:   "hello@wallapop.com",
		BannerURL:      "https://www.elnacional.cat/uploads/s1/57/43/03/77/wallapop.png",
	},
	{
		Name:           "Cabify",
		Tagline:        "Mobility that moves people and cities forward",
		Description:    "Cabify is a Madrid-born ride-hailing and urban mobility platform operating across Spain and Latin America. Founded in 2011, Cabify differentiates on safety, driver conditions, and sustainability — offering carbon-neutral rides since 2018. The company has raised over $500M and operates profitably in several markets, serving millions of users across 40+ cities. Cabify employs 3,000+ people and is one of the most recognised tech brands in the Spanish-speaking world.",
		Website:        "cabify.com",
		LogoURL:        "https://play-lh.googleusercontent.com/7F3WB7mlIU8sW_CA1VsrRZGm8WxfJ7CXVkfPOBYyCgafbjpuCMOdO3dNa-RsgCIvZccyucv7JqHcUd7Vxn5qYuA=w240-h480",
		Industry:       "Marketplace",
		Stage:          "growth",
		Location:       "Madrid, Spain",
		FoundedYear:    2011,
		TeamSize:       3000,
		IsRaising:      false,
		IsHiring:       true,
		OpenRoles:      "Backend Engineer, City Operations Manager, Growth Lead",
		Linkedin:       "cabify",
		Twitter:        "cabify_espana",
		Github:         "cabify",
		Instagram:      "cabify_espana",
		ProductIos:     "https://apps.apple.com/es/app/cabify-viaja-como-te-mereces/id476087442",
		ProductAndroid: "https://play.google.com/store/apps/details?id=com.cabify.rider",
		ContactEmail:   "hello@cabify.com",
		BannerURL:      "https://apurplelife.com/wp-content/uploads/2022/12/cabify-go.png",
	},
	{
		Name:           "Fever",
		Tagline:        "Discover the best experiences in your city",
		Description:    "Fever is a Madrid-founded live entertainment platform that helps people discover and book local experiences — from secret dining events and art exhibitions to immersive shows and concerts. Founded in 2014 and now headquartered in New York and Madrid, Fever serves 100M+ users across 100 cities worldwide. The company reached unicorn status with a $1B+ valuation and counts Rakuten and Goldman Sachs among its investors. It produces its own IP events including Candlelight concerts.",
		Website:        "feverup.com",
		LogoURL:        "https://play-lh.googleusercontent.com/orJJNH-6C6-MQYCLugKVhJMQ5E1dIT15QVTHA37e5gkALWMseBpeZ0lKGhnXln_rz2s6deMOI6BeDvoa0xRvTw=w240-h480",
		Industry:       "Consumer",
		Stage:          "growth",
		Location:       "Madrid, Spain",
		FoundedYear:    2014,
		TeamSize:       1000,
		IsRaising:      false,
		IsHiring:       true,
		OpenRoles:      "Event Producer, Software Engineer, Marketing Manager",
		Linkedin:       "fever-up",
		Github:         "feverup",
		Twitter:        "fever_us",
		Instagram:      "fever_us",
		ProductIos:     "https://apps.apple.com/es/app/fever-ocio-y-eventos/id497702817",
		ProductAndroid: "https://play.google.com/store/apps/details?id=com.feverup.fever",
		ContactEmail:   "hello@feverup.com",
		BannerURL:      "https://external-content.duckduckgo.com/iu/?u=https%3A%2F%2Flookaside.fbsbx.com%2Flookaside%2Fcrawler%2Fmedia%2F%3Fmedia_id%3D935536578533497&f=1&nofb=1&ipt=ee103216a4451d950a199142ad958670e322e2b09a26fdae5638f0f47418d240",
	},
	{
		Name:           "Jobandtalent",
		Tagline:        "The workforce platform built for blue-collar workers",
		Description:    "Jobandtalent is a Madrid-based workforce marketplace connecting companies with vetted temporary and permanent workers in logistics, warehousing, manufacturing, and retail. Founded in 2009, the platform manages the full employment lifecycle — hiring, onboarding, payroll, and scheduling — acting as the legal employer for workers it places. Jobandtalent is valued at $2.4B, has raised over $500M, and operates in 10+ countries, placing over 100,000 workers per month.",
		Website:        "jobandtalent.com",
		LogoURL:        "https://play-lh.googleusercontent.com/X0-ZsND6xFTVReRYeO3xuojs5Wv9y3kxFnXuC_-b7rTSyAjq5lhmtm8A4heOtKD-7O8ZIQ1Ohtde7xRPXS6DENQ=w240-h480",
		Industry:       "HR Tech",
		Stage:          "growth",
		Location:       "Madrid, Spain",
		FoundedYear:    2009,
		TeamSize:       1000,
		IsRaising:      false,
		IsHiring:       true,
		OpenRoles:      "Account Executive, Operations Lead, Data Engineer",
		Linkedin:       "jobandtalent",
		Twitter:        "jobandtalent_hq",
		Github:         "jobandtalent",
		Instagram:      "jobandtalent",
		ProductIos:     "https://apps.apple.com/es/app/job-talent/id665060895",
		ProductAndroid: "https://play.google.com/store/apps/details?id=com.jobandtalent.android",
		ContactEmail:   "hello@jobandtalent.com",
		BannerURL:      "https://images.ctfassets.net/rwvqakfewndl/5NEixflaVJH2J5suXIpn7P/6b31ab4680c4bf74eb08bebc0ea2e64b/Uplift_illustration.png?fm=jpg&q=90&w=1210&bg=rgb%3A00d6c9",
	},
}

func main() {
	reset := flag.Bool("reset", false, "delete existing seed rows before inserting")
	flag.Parse()

	_ = godotenv.Load("../../.env")
	_ = godotenv.Load("../../apps/server/.env")

	dbURL := env("DATABASE_URL", "postgres://narval:narval@localhost:5432/narval?sslmode=disable")
	minioEndpoint := env("MINIO_ENDPOINT", "localhost:9000")
	minioAccess := env("MINIO_ACCESS_KEY", "minioadmin")
	minioSecret := env("MINIO_SECRET_KEY", "minioadmin")
	minioBucket := env("MINIO_BUCKET", "narval")
	minioPublicURL := env("MINIO_PUBLIC_URL", "http://localhost:9000")

	db, err := gorm.Open(postgres.Open(dbURL), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Warn),
	})
	if err != nil {
		log.Fatalf("db connect: %v", err)
	}
	if err := db.AutoMigrate(&models.Startup{}); err != nil {
		log.Fatalf("seed: automigrate: %v", err)
	}

	if *reset {
		log.Println("seed: deleting existing seed rows…")
		db.Where("owner_id = ?", "seed").Delete(&models.Startup{})
	}

	mc, err := minio.New(minioEndpoint, &minio.Options{
		Creds: credentials.NewStaticV4(minioAccess, minioSecret, ""),
	})
	if err != nil {
		log.Fatalf("minio client: %v", err)
	}

	ctx := context.Background()

	if exists, _ := mc.BucketExists(ctx, minioBucket); !exists {
		if err := mc.MakeBucket(ctx, minioBucket, minio.MakeBucketOptions{}); err != nil {
			log.Fatalf("minio make bucket: %v", err)
		}
		policy := fmt.Sprintf(`{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":"*","Action":["s3:GetObject"],"Resource":["arn:aws:s3:::%s/*"]}]}`, minioBucket)
		_ = mc.SetBucketPolicy(ctx, minioBucket, policy)
	}

	_, filename, _, _ := runtime.Caller(0)
	scriptDir := filepath.Dir(filename)
	placeholderLogoPath := filepath.Join(scriptDir, "assets", "placeholder_logo.jpeg")

	fmt.Printf("\nSeeding %d startups...\n", len(startups))
	bar := progressbar.NewOptions(len(startups),
		progressbar.OptionSetDescription("Startups"),
		progressbar.OptionSetWidth(40),
		progressbar.OptionShowCount(),
		progressbar.OptionSetTheme(progressbar.Theme{
			Saucer: "=", SaucerHead: ">", SaucerPadding: " ", BarStart: "[", BarEnd: "]",
		}),
	)

	for _, s := range startups {
		logoURL := uploadImageFromURLOrPlaceholder(ctx, mc, minioBucket, minioPublicURL,
			fmt.Sprintf("logos/seed/%s-%s.jpeg", slugify(s.Name), uuid.NewString()[:8]),
			s.LogoURL, placeholderLogoPath)

		bannerURL := ""
		if s.BannerURL != "" {
			bannerURL = uploadImageFromURL(ctx, mc, minioBucket, minioPublicURL,
				fmt.Sprintf("banners/seed/%s-%s.jpeg", slugify(s.Name), uuid.NewString()[:8]),
				s.BannerURL)
		}

		productLinks := map[string]string{}
		if s.Website != "" {
			productLinks["web"] = "https://" + s.Website
		}
		if s.ProductIos != "" {
			productLinks["ios"] = s.ProductIos
		}
		if s.ProductAndroid != "" {
			productLinks["android"] = s.ProductAndroid
		}
		productJSON, _ := json.Marshal(productLinks)
		if len(productLinks) == 0 {
			productJSON = []byte("{}")
		}

		startup := models.Startup{
			Name:           s.Name,
			Tagline:        s.Tagline,
			Description:    s.Description,
			Website:        s.Website,
			LogoURL:        logoURL,
			BannerImage:    bannerURL,
			Industry:       s.Industry,
			Stage:          s.Stage,
			Location:       s.Location,
			FoundedYear:    s.FoundedYear,
			TeamSize:       s.TeamSize,
			IsRaising:      s.IsRaising,
			CurrentRound:   s.CurrentRound,
			FundingAsk:     s.FundingAsk,
			IsHiring:       s.IsHiring,
			OpenRoles:      s.OpenRoles,
			Linkedin:       social("https://linkedin.com/company/", s.Linkedin),
			Twitter:        social("https://x.com/", s.Twitter),
			Github:         social("https://github.com/", s.Github),
			Instagram:      social("https://instagram.com/", s.Instagram),
			ContactGeneral: s.ContactEmail,
			ContactFunding: s.ContactEmail,
			ProductLinks:   string(productJSON),
			OwnerID:        "seed",
			OwnerEmail:     s.ContactEmail,
			ProfileSetup:   true,
		}

		if err := db.Where(models.Startup{Name: startup.Name}).FirstOrCreate(&startup).Error; err != nil {
			log.Printf("failed to upsert %q: %v", startup.Name, err)
		}
		bar.Add(1)
	}
	fmt.Println()
	fmt.Println("\nSeed completed successfully!")
}

func uploadImageFromURL(ctx context.Context, mc *minio.Client, bucket, publicURL, objectName, imageURL string) string {
	if imageURL == "" {
		return ""
	}
	resp, err := http.Get(imageURL)
	if err != nil || resp.StatusCode != http.StatusOK {
		return ""
	}
	defer resp.Body.Close()
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return ""
	}
	ct := resp.Header.Get("Content-Type")
	if ct == "" {
		ct = "image/jpeg"
	}
	_, err = mc.PutObject(ctx, bucket, objectName, bytes.NewReader(data), int64(len(data)), minio.PutObjectOptions{ContentType: ct})
	if err != nil {
		return ""
	}
	return fmt.Sprintf("%s/%s/%s", publicURL, bucket, objectName)
}

func uploadLocalFile(ctx context.Context, mc *minio.Client, bucket, publicURL, objectName, localPath string) string {
	data, err := os.ReadFile(localPath)
	if err != nil {
		return ""
	}
	_, err = mc.PutObject(ctx, bucket, objectName, bytes.NewReader(data), int64(len(data)), minio.PutObjectOptions{ContentType: "image/jpeg"})
	if err != nil {
		return ""
	}
	return fmt.Sprintf("%s/%s/%s", publicURL, bucket, objectName)
}

func uploadImageFromURLOrPlaceholder(ctx context.Context, mc *minio.Client, bucket, publicURL, objectName, imageURL, placeholderPath string) string {
	if imageURL != "" {
		if url := uploadImageFromURL(ctx, mc, bucket, publicURL, objectName, imageURL); url != "" {
			return url
		}
	}
	return uploadLocalFile(ctx, mc, bucket, publicURL, objectName, placeholderPath)
}

func social(prefix, handle string) string {
	if handle == "" {
		return ""
	}
	return prefix + handle
}

func slugify(name string) string {
	s := strings.ToLower(name)
	s = strings.ReplaceAll(s, " ", "-")
	s = strings.ReplaceAll(s, ".", "")
	s = strings.ReplaceAll(s, ",", "")
	return s
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
