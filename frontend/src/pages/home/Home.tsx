import "./Home.css";
import { useEffect, useState } from "react";
import { useTranslation } from "@/context/LanguageContext";
import type { HomeData } from "@/data/homeData";
import { domainApi } from "@/services/api";
import {
  type IconName,
  Hero,
  SectionHeading,
  Icon,
  CategoryCard,
  Button,
  ListingCard,
  Stats,
  HowItWorks,
  Promo,
  Footer,
} from "@/components/home/HomeParts";

export function AppContent() {
  const [home, setHome] = useState<HomeData>({
    categories: [],
    featured: [],
    sellers: [],
    stats: {
      activeListings: 0,
      verifiedSellers: 0,
      successfulTrades: 0,
      satisfiedPercent: 0,
    },
    reviews: [],
  });
  const [homeLoading, setHomeLoading] = useState(true);
  const [homeError, setHomeError] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    void domainApi
      .home()
      .then((data) => {
        setHome(data);
        setHomeError(false);
      })
      .catch(() => setHomeError(true))
      .finally(() => setHomeLoading(false));
  }, []);

  const benefits = [
    [
      "user",
      "Verified Sellers",
      "Trade with sellers whose identity and business information have been verified.",
    ],
    [
      "lock",
      "Secure Transactions",
      "Protect your payment and sensitive transaction information.",
    ],
    [
      "quality",
      "Quality Listings",
      "Detailed information and photos help buyers make better decisions.",
    ],
    [
      "shield",
      "Trade Protection",
      "Support and dispute assistance for eligible transactions.",
    ],
  ] as [IconName, string, string][];

  return (
    <div className="home-view-1">
      <main>
        <Hero
          activeListings={home.stats.activeListings}
          verifiedSellers={home.stats.verifiedSellers}
          image="/hero-koi.jpg"
        />

        <section id="categories" className="home-view-2">
          <div className="home-view-3">
            <SectionHeading
              eyebrow="Browse by type"
              title="Explore Fish Categories"
              subtitle="Discover the right stock across popular species and trade categories."
              action={
                <a href="#marketplace" className="home-view-4">
                  {t("View all categories")}{" "}
                  <Icon name="arrow" className="home-view-5" />
                </a>
              }
            />
            <div className="home-view-6">
              {home.categories.map((item) => (
                <CategoryCard key={item.name} item={item} />
              ))}
            </div>
            {!homeLoading && !home.categories.length && (
              <p>
                {t(
                  homeError
                    ? "Unable to load marketplace data."
                    : "No approved listings yet.",
                )}
              </p>
            )}
          </div>
        </section>

        <section id="featured" className="home-view-7">
          <div className="home-view-3">
            <SectionHeading
              eyebrow="Curated marketplace"
              title="Featured Fish"
              subtitle="Quality fish currently available on the marketplace"
              action={
                <Button
                  variant="secondary"
                  className="home-view-8"
                  onClick={() => {
                    window.location.hash = "marketplace";
                  }}
                >
                  {t("Browse all listings")}
                </Button>
              }
            />
            <div className="home-view-9">
              {home.featured.map((item) => (
                <ListingCard key={item.id} item={item} />
              ))}
            </div>
            {!homeLoading && !home.featured.length && (
              <p>
                {t(
                  homeError
                    ? "Unable to load marketplace data."
                    : "No approved listings yet.",
                )}
              </p>
            )}
          </div>
        </section>

        <Stats stats={home.stats} />
        <HowItWorks />

        <section id="safety" className="home-view-2">
          <div className="home-view-3">
            <SectionHeading
              eyebrow="Trust at every step"
              title="Built for Safer Fish Trading"
              subtitle="The standards, safeguards, and transparency professional aquatic commerce needs."
            />
            <div className="home-view-11">
              {benefits.map(([icon, title, text]) => (
                <article key={title} className="home-view-12">
                  <span className="home-view-13">
                    <Icon name={icon} />
                  </span>
                  <h3 className="home-view-14">{t(title)}</h3>
                  <p className="home-view-15">{t(text)}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <Promo />
      </main>
      <Footer />
    </div>
  );
}
