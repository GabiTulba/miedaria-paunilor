#!/usr/bin/env python3
"""
Seed script: creates 100 products and 50 blog posts via the admin API.

Usage:
    python3 scripts/seed_data.py [--url https://localhost] [--user admin] [--password password]

Options:
    --url       Base URL of the site (default: https://localhost)
    --user      Admin username (default: admin)
    --password  Admin password (default: password)
    --no-verify Skip TLS certificate verification (default: True for localhost)
"""

import argparse
import json
import random
import sys
import urllib.request
import urllib.error
import ssl
from datetime import date, timedelta

# ── Enum pools ────────────────────────────────────────────────────────────────

MEAD_TYPES = [
    "hidromel", "melomel", "metheglin", "bochet", "braggot",
    "pyment", "cyser", "rhodomel", "capsicumel", "acerglyn",
]
SWEETNESS = ["bone-dry", "dry", "semi-dry", "semi-sweet", "sweet", "dessert"]
TURBIDITY = ["crystalline", "hazy", "cloudy"]
EFFERVESCENCE = ["flat", "perlant", "sparkling"]
ACIDITY = ["mild", "moderate", "strong"]
TANNINS = ["mild", "moderate", "strong"]
BODY = ["light", "medium", "full"]
BOTTLE_SIZES = [375, 500, 750, 1000]

# ── Name pools ────────────────────────────────────────────────────────────────

ADJECTIVES_EN = [
    "Golden", "Wild", "Forest", "Ancient", "Summer", "Winter", "Spring",
    "Autumn", "Harvest", "Dark", "Amber", "Crystal", "Velvet", "Royal",
    "Mountain", "Valley", "Sunset", "Midnight", "Dawn", "Misty",
]
ADJECTIVES_RO = [
    "Auriu", "Sălbatic", "Pădure", "Antic", "Vară", "Iarnă", "Primăvară",
    "Toamnă", "Recoltă", "Întunecat", "Chihlimbar", "Cristal", "Catifel", "Regal",
    "Munte", "Vale", "Apus", "Miez de noapte", "Zori", "Cețos",
]
NOUNS_EN = [
    "Blossom", "Nectar", "Meadow", "Grove", "Hive", "Heritage", "Legacy",
    "Reserve", "Cuvée", "Expression", "Estate", "Craft", "Artisan", "Treasury",
    "Elixir", "Potion", "Essence", "Spirit", "Touch", "Whisper",
]
NOUNS_RO = [
    "Floare", "Nectar", "Câmpie", "Crâng", "Stup", "Moștenire", "Legat",
    "Rezervă", "Cupaj", "Expresie", "Domeniu", "Meșteșug", "Artizan", "Tezaur",
    "Elixir", "Poțiune", "Esență", "Spirit", "Atingere", "Șoaptă",
]
FRUITS_EN = [
    "Cherry", "Raspberry", "Blackberry", "Blueberry", "Strawberry", "Apricot",
    "Peach", "Plum", "Apple", "Pear", "Quince", "Elderflower", "Rose Hip",
    "Lavender", "Hawthorn",
]
FRUITS_RO = [
    "Cireșe", "Zmeură", "Mure", "Afine", "Căpșuni", "Caise",
    "Piersici", "Prune", "Mere", "Pere", "Gutui", "Flori de soc", "Măceșe",
    "Lavandă", "Păducel",
]
AUTHORS = [
    "Alexandru Paunescu", "Maria Ionescu", "Gheorghe Munteanu",
    "Elena Popescu", "Andrei Florescu", "Cristina Dumitrescu",
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def r(pool):
    return random.choice(pool)

def rand_abv():
    return round(random.uniform(5.0, 18.0), 1)

def rand_price_eur():
    return round(random.uniform(12.0, 85.0), 2)

def rand_price_ron(eur):
    return round(eur * random.uniform(4.90, 5.10), 2)

def rand_date():
    days_back = random.randint(30, 900)
    return (date.today() - timedelta(days=days_back)).isoformat()

def slug_from(text):
    return text.lower().replace(" ", "-").replace("'", "").replace(",", "")


# ── Data generators ───────────────────────────────────────────────────────────

def make_product(index: int) -> dict:
    adj_en = r(ADJECTIVES_EN)
    adj_ro = r(ADJECTIVES_RO)
    fruit_en = r(FRUITS_EN)
    fruit_ro = r(FRUITS_RO)
    noun_en = r(NOUNS_EN)
    noun_ro = r(NOUNS_RO)
    mead_type = r(MEAD_TYPES)

    name_en = f"{adj_en} {fruit_en} {noun_en}"
    name_ro = f"{adj_ro} {fruit_ro} {noun_ro}"
    product_id = f"{adj_en.lower()}-{fruit_en.lower().replace(' ', '-')}-{index:03d}"

    eur = rand_price_eur()
    abv = rand_abv()
    bottle_size = r(BOTTLE_SIZES)

    description_en = (
        f"A {mead_type} crafted with the finest {fruit_en.lower()} and raw wildflower honey. "
        f"Fermented slowly to develop complexity, this mead delivers a {r(BODY)}-bodied experience "
        f"with {r(SWEETNESS)} character and a lingering finish. "
        f"Ideal for pairing with aged cheeses, charcuterie, or enjoyed on its own."
    )
    description_ro = (
        f"Un {mead_type} preparat din {fruit_ro.lower()} selectate și miere de flori de câmp. "
        f"Fermentat lent pentru a dezvolta complexitate, acest hidromel oferă un profil {r(BODY)} "
        f"cu caracter {r(SWEETNESS)} și un final persistent. "
        f"Ideal alături de brânzeturi maturate, mezeluri sau savurat singur."
    )
    ingredients_en = (
        f"Water, wildflower honey, {fruit_en.lower()}, wine yeast, citric acid, potassium metabisulphite."
    )
    ingredients_ro = (
        f"Apă, miere de flori de câmp, {fruit_ro.lower()}, drojdie de vin, acid citric, metabisulfit de potasiu."
    )

    return {
        "product_id": product_id[:128],
        "product_name": name_en,
        "product_name_ro": name_ro,
        "product_description": description_en,
        "product_description_ro": description_ro,
        "ingredients": ingredients_en,
        "ingredients_ro": ingredients_ro,
        "product_type": mead_type,
        "sweetness": r(SWEETNESS),
        "turbidity": r(TURBIDITY),
        "effervescence": r(EFFERVESCENCE),
        "acidity": r(ACIDITY),
        "tannins": r(TANNINS),
        "body": r(BODY),
        "abv": abv,
        "bottle_count": random.randint(0, 120),
        "bottle_size": bottle_size,
        "price": eur,
        "price_ron": rand_price_ron(eur),
        "image_id": None,
        "bottling_date": rand_date(),
        "lot_number": random.randint(1, 50),
    }


def make_blog_post(index: int) -> dict:
    topic_en = r([
        "The Art of Meadmaking", "Honey Sourcing", "Pairing Mead with Food",
        "Our Harvest Season", "The History of Mead", "Fermentation Science",
        "Wild Yeast and Terroir", "Seasonal Ingredients", "Tasting Notes",
        "Behind the Scenes", "Visiting the Meadery", "Mead Competitions",
        "Sustainable Beekeeping", "Cold Stabilization", "Bottle Conditioning",
    ])
    topic_ro = r([
        "Arta Fabricării Hidromelului", "Aprovizionarea cu Miere", "Combinații cu Mâncare",
        "Sezonul Recoltei Noastre", "Istoria Hidromelului", "Știința Fermentației",
        "Drojdie Sălbatică și Terroir", "Ingrediente de Sezon", "Note de Degustare",
        "În Culise", "Vizitând Miedăria", "Concursuri de Hidromel",
        "Apicultură Durabilă", "Stabilizare la Rece", "Condiționarea în Sticlă",
    ])

    title_en = f"{topic_en}: Part {index}"
    title_ro = f"{topic_ro}: Partea {index}"
    slug = f"{slug_from(topic_en)}-{index}"

    content_en = f"""## {topic_en}

Welcome to Miedăria Păunilor. In this post we explore **{topic_en.lower()}** and what it means
for our craft.

### Our Approach

Every bottle we produce starts with exceptional honey sourced from local beekeepers
who share our commitment to sustainable apiculture. The journey from flower to glass
is long, but every step matters.

### The Process

1. **Honey selection** — we taste every batch before committing to a purchase.
2. **Water quality** — mineral-balanced water is the invisible backbone of every mead.
3. **Yeast health** — a slow, cool fermentation preserves delicate floral esters.
4. **Patience** — our meads rest for a minimum of six months before bottling.

### Closing Thoughts

Thank you for joining us on this journey. We hope our meads bring joy to your table.
"""
    content_ro = f"""## {topic_ro}

Bine ați venit la Miedăria Păunilor. În această postare explorăm **{topic_ro.lower()}** și ce înseamnă
aceasta pentru meșteșugul nostru.

### Abordarea Noastră

Fiecare sticlă pe care o producem pornește de la miere excepțională, achiziționată de la apicultori locali
care împărtășesc angajamentul nostru față de apicultura durabilă.

### Procesul

1. **Selecția mierii** — degustăm fiecare lot înainte de a face o achiziție.
2. **Calitatea apei** — apa echilibrată mineral este coloana vertebrală invizibilă a fiecărui hidromel.
3. **Sănătatea drojdiei** — o fermentație lentă și rece păstrează esterii florali delicați.
4. **Răbdarea** — hidromelurile noastre se odihnesc minimum șase luni înainte de îmbuteliere.

### Gânduri de Încheiere

Vă mulțumim că ne însoțiți în această călătorie.
"""

    excerpt_en = (
        f"Discover how {topic_en.lower()} shapes the character of every bottle "
        f"we craft at Miedăria Păunilor."
    )
    excerpt_ro = (
        f"Descoperiți cum {topic_ro.lower()} definește caracterul fiecărei sticle "
        f"pe care o producem la Miedăria Păunilor."
    )

    return {
        "title": title_en,
        "title_ro": title_ro,
        "slug": slug[:256],
        "content_markdown": content_en,
        "content_markdown_ro": content_ro,
        "excerpt": excerpt_en[:1024],
        "excerpt_ro": excerpt_ro[:1024],
        "author": r(AUTHORS),
        "is_published": random.random() > 0.2,  # 80% published
    }


# ── HTTP helpers ──────────────────────────────────────────────────────────────

def api_request(ctx, method, path, body=None):
    url = ctx["base_url"] + path
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Content-Type": "application/json"}
    if ctx.get("token"):
        headers["Authorization"] = f"Bearer {ctx['token']}"

    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, context=ctx["ssl_ctx"]) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        try:
            body_bytes = e.read()
            return e.code, json.loads(body_bytes)
        except Exception:
            return e.code, {}


def login(ctx):
    status, body = api_request(ctx, "POST", "/api/admin/login", {
        "username": ctx["username"],
        "password": ctx["password"],
    })
    if status != 200:
        print(f"  Login failed ({status}): {body}")
        sys.exit(1)
    ctx["token"] = body["token"]
    print(f"  Logged in as {ctx['username']}")


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Seed 100 products and 50 blog posts.")
    parser.add_argument("--url", default="https://localhost", help="Base URL")
    parser.add_argument("--user", default="admin", help="Admin username")
    parser.add_argument("--password", default="password", help="Admin password")
    parser.add_argument("--no-verify", action="store_true", help="Skip TLS verification")
    args = parser.parse_args()

    ssl_ctx = ssl.create_default_context()
    if args.no_verify or "localhost" in args.url or "127.0.0.1" in args.url:
        ssl_ctx.check_hostname = False
        ssl_ctx.verify_mode = ssl.CERT_NONE

    ctx = {
        "base_url": args.url.rstrip("/"),
        "username": args.user,
        "password": args.password,
        "ssl_ctx": ssl_ctx,
        "token": None,
    }

    print("=== Miedăria Păunilor — Seed Script ===\n")
    print("Logging in...")
    login(ctx)

    # ── Products ──────────────────────────────────────────────────────────────
    print("\nCreating 100 products...")
    ok = err = 0
    for i in range(1, 101):
        product = make_product(i)
        status, body = api_request(ctx, "POST", "/api/admin/products", product)
        if status in (200, 201):
            ok += 1
            print(f"  [{i:3d}/100] OK  — {product['product_id']}")
        else:
            err += 1
            print(f"  [{i:3d}/100] FAIL ({status}) — {product['product_id']}: {body}")

    print(f"\nProducts: {ok} created, {err} failed.")

    # ── Blog posts ────────────────────────────────────────────────────────────
    print("\nCreating 50 blog posts...")
    ok = err = 0
    for i in range(1, 51):
        post = make_blog_post(i)
        status, body = api_request(ctx, "POST", "/api/admin/blog", post)
        if status in (200, 201):
            ok += 1
            print(f"  [{i:2d}/50] OK  — {post['slug']}")
        else:
            err += 1
            print(f"  [{i:2d}/50] FAIL ({status}) — {post['slug']}: {body}")

    print(f"\nBlog posts: {ok} created, {err} failed.")
    print("\nDone.")


if __name__ == "__main__":
    random.seed(42)
    main()
