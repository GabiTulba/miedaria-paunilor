use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum MeadType {
    Hidromel,
    Melomel,
    Metheglin,
    Bochet,
    Braggot,
    Pyment,
    Cyser,
    Rhodomel,
    Capsicumel,
    Acerglyn,
}

impl MeadType {
    pub fn as_str(&self) -> &'static str {
        match self {
            MeadType::Hidromel => "hidromel",
            MeadType::Melomel => "melomel",
            MeadType::Metheglin => "metheglin",
            MeadType::Bochet => "bochet",
            MeadType::Braggot => "braggot",
            MeadType::Pyment => "pyment",
            MeadType::Cyser => "cyser",
            MeadType::Rhodomel => "rhodomel",
            MeadType::Capsicumel => "capsicumel",
            MeadType::Acerglyn => "acerglyn",
        }
    }
    
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "hidromel" => Some(MeadType::Hidromel),
            "melomel" => Some(MeadType::Melomel),
            "metheglin" => Some(MeadType::Metheglin),
            "bochet" => Some(MeadType::Bochet),
            "braggot" => Some(MeadType::Braggot),
            "pyment" => Some(MeadType::Pyment),
            "cyser" => Some(MeadType::Cyser),
            "rhodomel" => Some(MeadType::Rhodomel),
            "capsicumel" => Some(MeadType::Capsicumel),
            "acerglyn" => Some(MeadType::Acerglyn),
            _ => None,
        }
    }
    
    pub fn all() -> Vec<Self> {
        vec![
            MeadType::Hidromel,
            MeadType::Melomel,
            MeadType::Metheglin,
            MeadType::Bochet,
            MeadType::Braggot,
            MeadType::Pyment,
            MeadType::Cyser,
            MeadType::Rhodomel,
            MeadType::Capsicumel,
            MeadType::Acerglyn,
        ]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum SweetnessType {
    BoneDry,
    Dry,
    SemiDry,
    SemiSweet,
    Sweet,
    Dessert,
}

impl SweetnessType {
    pub fn as_str(&self) -> &'static str {
        match self {
    SweetnessType::BoneDry => "bone-dry",
    SweetnessType::Dry => "dry",
    SweetnessType::SemiDry => "semi-dry",
    SweetnessType::SemiSweet => "semi-sweet",
    SweetnessType::Sweet => "sweet",
    SweetnessType::Dessert => "dessert",
        }
    }
    
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "bone-dry" => Some(SweetnessType::BoneDry),
            "dry" => Some(SweetnessType::Dry),
            "semi-dry" => Some(SweetnessType::SemiDry),
            "semi-sweet" => Some(SweetnessType::SemiSweet),
            "sweet" => Some(SweetnessType::Sweet),
            "dessert" => Some(SweetnessType::Dessert),
            _ => None,
        }
    }
    
    pub fn all() -> Vec<Self> {
        vec![
            SweetnessType::BoneDry,
            SweetnessType::Dry,
            SweetnessType::SemiDry,
            SweetnessType::SemiSweet,
            SweetnessType::Sweet,
            SweetnessType::Dessert,
        ]
    }
}