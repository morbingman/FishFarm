import "./Home.css";
import { Input as UiInput } from "@/components/ui/input";
import { Label as UiLabel } from "@/components/ui/label";
import { useState } from "react";
import { useTranslation } from "@/context/LanguageContext";
import { photos, categories, listings, sellers } from "@/data/homeData";
import {
  type IconName,
  Hero,
  SectionHeading,
  Icon,
  CategoryCard,
  Button,
  ListingCard,
  Stats,
  SellerCard,
  HowItWorks,
  Promo,
  Footer,
} from "@/components/home/HomeParts";
export function AppContent() {
  const [subscribed, setSubscribed] = useState(false);
  const { language, t } = useTranslation();
  const reviews = [
    [
      "Minh Tran",
      "Verified Buyer",
      "The seller verification and detailed listing gave me the confidence to purchase a high-value koi online.",
      "12 Feb 2026",
    ],
    [
      "Sarah Lim",
      "Aquatic Retailer",
      "We have found three reliable farm partners through Fishmarket. It has changed how we source stock.",
      "06 Feb 2026",
    ],
    [
      "Daniel Wong",
      "Verified Seller",
      "The enquiries are serious and the tools make managing my listings remarkably straightforward.",
      "28 Jan 2026",
    ],
  ];
  const articles = [
    [
      "Buyer Guide",
      "How to Choose a Healthy Ornamental Fish",
      "Key signs of health, vitality, and responsible breeding to look for before you buy.",
      photos.blue,
    ],
    [
      "Market Report",
      "Understanding Fish Market Prices",
      "Learn what drives pricing across species, grades, sizes, origins, and seasons.",
      photos.koiSchool,
    ],
    [
      "Safety",
      "Guide to Buying Fish Online Safely",
      "A practical checklist for assessing listings, sellers, shipping, and payment.",
      photos.clown,
    ],
  ];
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
        <Hero />

        <section id="categories" className="home-view-2">
          <div className="home-view-3">
            <SectionHeading
              eyebrow="Browse by type"
              title="Explore Fish Categories"
              subtitle="Discover the right stock across popular species and trade categories."
              action={
                <a href="#" className="home-view-4">
                  {t("View all categories")}{" "}
                  <Icon name="arrow" className="home-view-5" />
                </a>
              }
            />
            <div className="home-view-6">
              {categories.map((item) => (
                <CategoryCard key={item[0]} item={item} />
              ))}
            </div>
          </div>
        </section>

        <section id="featured" className="home-view-7">
          <div className="home-view-3">
            <SectionHeading
              eyebrow="Curated marketplace"
              title="Featured Fish"
              subtitle="Quality listings from trusted sellers"
              action={
                <Button variant="secondary" className="home-view-8">
                  {t("Browse all listings")}
                </Button>
              }
            />
            <div className="home-view-9">
              {listings.map((item, index) => (
                <ListingCard key={item.name} item={item} index={index} />
              ))}
            </div>
          </div>
        </section>

        <Stats />

        <section id="sellers" className="home-view-2">
          <div className="home-view-3">
            <SectionHeading
              eyebrow="Shop verified stores"
              title="Trusted Sellers"
              subtitle="Experienced farms, breeders, and aquatic specialists with proven track records."
              action={
                <a href="#" className="home-view-4">
                  {t("Explore sellers")}{" "}
                  <Icon name="arrow" className="home-view-5" />
                </a>
              }
            />
            <div className="home-view-10">
              {sellers.map((seller) => (
                <SellerCard key={seller.name} seller={seller} />
              ))}
            </div>
          </div>
        </section>

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

        <section id="reviews" className="home-view-7">
          <div className="home-view-3">
            <SectionHeading
              eyebrow="Community stories"
              title="What Our Community Says"
            />
            <div className="home-view-10">
              {reviews.map(([name, role, review, date], i) => (
                <article key={name} className="home-view-16">
                  <div className="home-view-17">
                    <div className="home-view-18">
                      <span className="home-view-19">
                        {name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")}
                      </span>
                      <div>
                        <h3 className="home-view-20">{name}</h3>
                        <p className="home-view-21">{t(role)}</p>
                      </div>
                    </div>
                    <span className="home-view-22">“</span>
                  </div>
                  <div className="home-view-23">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Icon key={star} name="star" className="home-view-24" />
                    ))}
                  </div>
                  <p className="home-view-25">{t(review)}</p>
                  <p className="home-view-26">
                    {date} · {language === "vi" ? "Giao dịch" : "Trade"} #
                    {16420 + i * 641}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="insights" className="home-view-2">
          <div className="home-view-3">
            <SectionHeading
              eyebrow="Market knowledge"
              title="Fish Trading Insights"
              subtitle="Practical guidance and analysis for smarter aquatic trade."
            />
            <div className="home-view-27">
              {articles.map(([category, title, desc, image]) => (
                <article key={title} className="group">
                  <div className="home-view-28">
                    <img src={image} alt="" className="home-view-29" />
                  </div>
                  <p className="home-view-30">{t(category)}</p>
                  <h3 className="home-view-31">{t(title)}</h3>
                  <p className="home-view-15">{t(desc)}</p>
                  <a href="#" className="home-view-32">
                    {t("Read More")}{" "}
                    <Icon name="arrow" className="home-view-5" />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="home-view-33">
          <div className="home-view-34">
            <div>
              <p className="home-view-35">{t("Weekly market brief")}</p>
              <h2 className="home-view-36">
                {t("Stay Ahead of the Fish Market")}
              </h2>
              <p className="home-view-37">
                {t(
                  "Get new listings, market updates, and fish trading insights delivered to your inbox.",
                )}
              </p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setSubscribed(true);
              }}
              className="home-view-38"
            >
              <UiLabel className="home-view-39">
                <Icon name="mail" className="home-view-40" />
                <span className="home-view-41">Email address</span>
                <UiInput
                  required
                  type="email"
                  className="home-view-42"
                  placeholder={t("Enter your email address")}
                />
              </UiLabel>
              <Button type="submit">
                {t(subscribed ? "Subscribed" : "Subscribe")}
              </Button>
            </form>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
