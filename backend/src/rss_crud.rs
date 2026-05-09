use crate::blog_crud::get_all_blog_posts;
use chrono::Utc;
use diesel::prelude::*;
use std::fmt::Write;

const FEED_LIMIT: i64 = 50;

fn xml_escape(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

/// Append `<name>{escaped content}</name>\n` (with the supplied indent) to
/// `out`. Eliminates the per-line `push_str(&format!(...))` boilerplate.
fn write_element(out: &mut String, indent: &str, name: &str, content: &str) {
    let _ = writeln!(out, "{indent}<{name}>{}</{name}>", xml_escape(content));
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
    write_element(&mut xml, "    ", "link", &blog_index_url);
    let _ = writeln!(
        xml,
        "    <atom:link href=\"{}\" rel=\"self\" type=\"application/rss+xml\"/>",
        xml_escape(&feed_self_url)
    );
    xml.push_str("    <description>Articole despre miere, hidromel și meșteșugul fermentației.</description>\n");
    xml.push_str("    <language>ro-RO</language>\n");
    write_element(&mut xml, "    ", "lastBuildDate", &last_build_date);

    for post in posts {
        let item_url = format!("{}/ro/blog/{}", site_url, post.slug);
        let pub_date = post
            .published_at
            .unwrap_or(post.updated_at)
            .and_utc()
            .to_rfc2822();

        xml.push_str("    <item>\n");
        write_element(&mut xml, "      ", "title", &post.title_ro);
        write_element(&mut xml, "      ", "link", &item_url);
        let _ = writeln!(
            xml,
            "      <guid isPermaLink=\"true\">{}</guid>",
            xml_escape(&item_url)
        );
        write_element(&mut xml, "      ", "description", &post.excerpt_ro);
        write_element(&mut xml, "      ", "pubDate", &pub_date);
        write_element(&mut xml, "      ", "dc:creator", &post.author);
        xml.push_str("    </item>\n");
    }

    xml.push_str("  </channel>\n");
    xml.push_str("</rss>\n");

    Ok(xml)
}
