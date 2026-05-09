use diesel_derive_enum::DbEnum;
use serde::{Deserialize, Serialize};
use strum::EnumIter;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, DbEnum, EnumIter)]
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, DbEnum, EnumIter)]
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

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, DbEnum, EnumIter)]
#[serde(rename_all = "kebab-case")]
#[ExistingTypePath = "crate::schema::sql_types::TurbidityTypeEnum"]
#[DbValueStyle = "kebab-case"]
pub enum TurbidityType {
    Crystalline,
    Hazy,
    Cloudy,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, DbEnum, EnumIter)]
#[serde(rename_all = "kebab-case")]
#[ExistingTypePath = "crate::schema::sql_types::EffervescenceTypeEnum"]
#[DbValueStyle = "kebab-case"]
pub enum EffervescenceType {
    Flat,
    Perlant,
    Sparkling,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, DbEnum, EnumIter)]
#[serde(rename_all = "kebab-case")]
#[ExistingTypePath = "crate::schema::sql_types::AcidityTypeEnum"]
#[DbValueStyle = "kebab-case"]
pub enum AcidityType {
    Mild,
    Moderate,
    Strong,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, DbEnum, EnumIter)]
#[serde(rename_all = "kebab-case")]
#[ExistingTypePath = "crate::schema::sql_types::TanninsTypeEnum"]
#[DbValueStyle = "kebab-case"]
pub enum TanninsType {
    Mild,
    Moderate,
    Strong,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, DbEnum, EnumIter)]
#[serde(rename_all = "kebab-case")]
#[ExistingTypePath = "crate::schema::sql_types::BodyTypeEnum"]
#[DbValueStyle = "kebab-case"]
pub enum BodyType {
    Light,
    Medium,
    Full,
}
