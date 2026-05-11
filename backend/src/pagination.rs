use serde::Deserialize;
use ts_rs::TS;

#[derive(Debug, Deserialize, TS)]
#[ts(export)]
pub struct PageQuery {
    #[ts(optional)] pub page: Option<u32>,
    #[ts(optional)] pub per_page: Option<u32>,
}

pub struct Page {
    pub limit: i64,
    pub offset: i64,
    pub per_page: i64,
}

impl PageQuery {
    pub fn resolve(&self, default_per_page: u32, max_per_page: u32) -> Page {
        let per_page = self.per_page.unwrap_or(default_per_page).min(max_per_page) as i64;
        let page = self.page.unwrap_or(1).max(1) as i64;
        Page {
            limit: per_page,
            offset: (page - 1) * per_page,
            per_page,
        }
    }
}

pub fn total_pages(total_count: i64, per_page: i64) -> u64 {
    (total_count.max(0) as u64).div_ceil(per_page.max(1) as u64)
}
