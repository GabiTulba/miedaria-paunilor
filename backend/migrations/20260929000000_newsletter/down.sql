DROP TRIGGER trg_blog_posts_updated_at ON blog_posts;
CREATE TRIGGER trg_blog_posts_updated_at
    BEFORE UPDATE ON blog_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
DROP FUNCTION update_blog_post_updated_at();

ALTER TABLE blog_posts DROP COLUMN notified_at;
DROP TABLE newsletter_subscribers;
