use crate::blog_crud::get_all_blog_posts;
use chrono::Utc;
use diesel::prelude::*;

const FEED_LIMIT: i64 = 50;

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

pub fn generate_rss_xml(
    conn: &mut PgConnection,
    site_url: &str,
) -> Result<String, diesel::result::Error> {
    let posts = get_all_blog_posts(conn, FEED_LIMIT, 0)?;

    let blog_index_url = format!("{}/ro/blog", site_url);
    let feed_self_url = format!("{}/blog/rss.xml", site_url);
    let last_build_date = Utc::now().to_rfc2822();

    let mut xml = String::new();
    xml.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
    xml.push_str("<rss version=\"2.0\" xmlns:atom=\"http://www.w3.org/2005/Atom\" xmlns:dc=\"http://purl.org/dc/elements/1.1/\">\n");
    xml.push_str("  <channel>\n");
    xml.push_str("    <title>Miedăria Păunilor — Blog</title>\n");
    xml.push_str(&format!("    <link>{}</link>\n", xml_escape(&blog_index_url)));
    xml.push_str(&format!(
        "    <atom:link href=\"{}\" rel=\"self\" type=\"application/rss+xml\"/>\n",
        xml_escape(&feed_self_url)
    ));
    xml.push_str("    <description>Articole despre miere, hidromel și meșteșugul fermentației.</description>\n");
    xml.push_str("    <language>ro-RO</language>\n");
    xml.push_str(&format!(
        "    <lastBuildDate>{}</lastBuildDate>\n",
        xml_escape(&last_build_date)
    ));

    for post in posts {
        let item_url = format!("{}/ro/blog/{}", site_url, post.slug);
        let pub_date = post
            .published_at
            .unwrap_or(post.updated_at)
            .and_utc()
            .to_rfc2822();

        xml.push_str("    <item>\n");
        xml.push_str(&format!(
            "      <title>{}</title>\n",
            xml_escape(&post.title_ro)
        ));
        xml.push_str(&format!(
            "      <link>{}</link>\n",
            xml_escape(&item_url)
        ));
        xml.push_str(&format!(
            "      <guid isPermaLink=\"true\">{}</guid>\n",
            xml_escape(&item_url)
        ));
        xml.push_str(&format!(
            "      <description>{}</description>\n",
            xml_escape(&post.excerpt_ro)
        ));
        xml.push_str(&format!(
            "      <pubDate>{}</pubDate>\n",
            xml_escape(&pub_date)
        ));
        xml.push_str(&format!(
            "      <dc:creator>{}</dc:creator>\n",
            xml_escape(&post.author)
        ));
        xml.push_str("    </item>\n");
    }

    xml.push_str("  </channel>\n");
    xml.push_str("</rss>\n");

    Ok(xml)
}
