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



#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TurbidityType {
    Crystalline,
    Hazy,
    Cloudy,
}

impl TurbidityType {
    pub fn as_str(&self) -> &'static str {
        match self {
            TurbidityType::Crystalline => "crystalline",
            TurbidityType::Hazy => "hazy",
            TurbidityType::Cloudy => "cloudy",
        }
    }
    
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "crystalline" => Some(TurbidityType::Crystalline),
            "hazy" => Some(TurbidityType::Hazy),
            "cloudy" => Some(TurbidityType::Cloudy),
            _ => None,
        }
    }
    
    pub fn all() -> Vec<Self> {
        vec![
            TurbidityType::Crystalline,
            TurbidityType::Hazy,
            TurbidityType::Cloudy,
        ]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum EffervescenceType {
    Flat,
    Perlant,
    Sparkling,
}

impl EffervescenceType {
    pub fn as_str(&self) -> &'static str {
        match self {
            EffervescenceType::Flat => "flat",
            EffervescenceType::Perlant => "perlant",
            EffervescenceType::Sparkling => "sparkling",
        }
    }
    
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "flat" => Some(EffervescenceType::Flat),
            "perlant" => Some(EffervescenceType::Perlant),
            "sparkling" => Some(EffervescenceType::Sparkling),
            _ => None,
        }
    }
    
    pub fn all() -> Vec<Self> {
        vec![
            EffervescenceType::Flat,
            EffervescenceType::Perlant,
            EffervescenceType::Sparkling,
        ]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum AcidityType {
    Mild,
    Moderate,
    Strong,
}

impl AcidityType {
    pub fn as_str(&self) -> &'static str {
        match self {
            AcidityType::Mild => "mild",
            AcidityType::Moderate => "moderate",
            AcidityType::Strong => "strong",
        }
    }
    
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "mild" => Some(AcidityType::Mild),
            "moderate" => Some(AcidityType::Moderate),
            "strong" => Some(AcidityType::Strong),
            _ => None,
        }
    }
    
    pub fn all() -> Vec<Self> {
        vec![
            AcidityType::Mild,
            AcidityType::Moderate,
            AcidityType::Strong,
        ]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TaninsType {
    Mild,
    Moderate,
}

impl TaninsType {
    pub fn as_str(&self) -> &'static str {
        match self {
            TaninsType::Mild => "mild",
            TaninsType::Moderate => "moderate",
        }
    }
    
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "mild" => Some(TaninsType::Mild),
            "moderate" => Some(TaninsType::Moderate),
            _ => None,
        }
    }
    
    pub fn all() -> Vec<Self> {
        vec![
            TaninsType::Mild,
            TaninsType::Moderate,
        ]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum BodyType {
    Light,
    Medium,
    Full,
}

impl BodyType {
    pub fn as_str(&self) -> &'static str {
        match self {
            BodyType::Light => "light",
            BodyType::Medium => "medium",
            BodyType::Full => "full",
        }
    }
    
    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "light" => Some(BodyType::Light),
            "medium" => Some(BodyType::Medium),
            "full" => Some(BodyType::Full),
            _ => None,
        }
    }
    
    pub fn all() -> Vec<Self> {
        vec![
            BodyType::Light,
            BodyType::Medium,
            BodyType::Full,
        ]
    }
}