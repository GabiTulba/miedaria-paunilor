use diesel_derive_enum::DbEnum;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, DbEnum)]
#[serde(rename_all = "kebab-case")]
#[ExistingTypePath = "crate::schema::sql_types::MeadTypeEnum"]
#[DbValueStyle = "kebab-case"]
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
    pub fn all() -> Vec<Self> {
        vec![
            Self::Hidromel,
            Self::Melomel,
            Self::Metheglin,
            Self::Bochet,
            Self::Braggot,
            Self::Pyment,
            Self::Cyser,
            Self::Rhodomel,
            Self::Capsicumel,
            Self::Acerglyn,
        ]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, DbEnum)]
#[serde(rename_all = "kebab-case")]
#[ExistingTypePath = "crate::schema::sql_types::SweetnessTypeEnum"]
#[DbValueStyle = "kebab-case"]
pub enum SweetnessType {
    BoneDry,
    Dry,
    SemiDry,
    SemiSweet,
    Sweet,
    Dessert,
}

impl SweetnessType {
    pub fn all() -> Vec<Self> {
        vec![
            Self::BoneDry,
            Self::Dry,
            Self::SemiDry,
            Self::SemiSweet,
            Self::Sweet,
            Self::Dessert,
        ]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, DbEnum)]
#[serde(rename_all = "kebab-case")]
#[ExistingTypePath = "crate::schema::sql_types::TurbidityTypeEnum"]
#[DbValueStyle = "kebab-case"]
pub enum TurbidityType {
    Crystalline,
    Hazy,
    Cloudy,
}

impl TurbidityType {
    pub fn all() -> Vec<Self> {
        vec![Self::Crystalline, Self::Hazy, Self::Cloudy]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, DbEnum)]
#[serde(rename_all = "kebab-case")]
#[ExistingTypePath = "crate::schema::sql_types::EffervescenceTypeEnum"]
#[DbValueStyle = "kebab-case"]
pub enum EffervescenceType {
    Flat,
    Perlant,
    Sparkling,
}

impl EffervescenceType {
    pub fn all() -> Vec<Self> {
        vec![Self::Flat, Self::Perlant, Self::Sparkling]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, DbEnum)]
#[serde(rename_all = "kebab-case")]
#[ExistingTypePath = "crate::schema::sql_types::AcidityTypeEnum"]
#[DbValueStyle = "kebab-case"]
pub enum AcidityType {
    Mild,
    Moderate,
    Strong,
}

impl AcidityType {
    pub fn all() -> Vec<Self> {
        vec![Self::Mild, Self::Moderate, Self::Strong]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, DbEnum)]
#[serde(rename_all = "kebab-case")]
#[ExistingTypePath = "crate::schema::sql_types::TanninsTypeEnum"]
#[DbValueStyle = "kebab-case"]
pub enum TanninsType {
    Mild,
    Moderate,
    Strong,
}

impl TanninsType {
    pub fn all() -> Vec<Self> {
        vec![Self::Mild, Self::Moderate, Self::Strong]
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, DbEnum)]
#[serde(rename_all = "kebab-case")]
#[ExistingTypePath = "crate::schema::sql_types::BodyTypeEnum"]
#[DbValueStyle = "kebab-case"]
pub enum BodyType {
    Light,
    Medium,
    Full,
}

impl BodyType {
    pub fn all() -> Vec<Self> {
        vec![Self::Light, Self::Medium, Self::Full]
    }
}
