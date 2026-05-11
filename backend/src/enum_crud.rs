use serde::{Deserialize, Serialize};
use strum::IntoEnumIterator;
use ts_rs::TS;

use crate::enums::*;

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct EnumValue {
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize, TS)]
#[ts(export)]
pub struct EnumValues {
    pub mead_type: Vec<EnumValue>,
    pub sweetness: Vec<EnumValue>,
    pub turbidity: Vec<EnumValue>,
    pub effervescence: Vec<EnumValue>,
    pub acidity: Vec<EnumValue>,
    pub tannins: Vec<EnumValue>,
    pub body: Vec<EnumValue>,
}

/// Serializes every variant of `E` (via `IntoEnumIterator`) and reads back the
/// kebab-case string the serde rename emits, returning a `Vec<EnumValue>`.
fn enum_values<E: IntoEnumIterator + Serialize>() -> Vec<EnumValue> {
    E::iter()
        .map(|e| EnumValue {
            value: serde_json::to_value(&e)
                .unwrap()
                .as_str()
                .unwrap()
                .to_string(),
        })
        .collect()
}

pub fn get_all_enum_values() -> EnumValues {
    EnumValues {
        mead_type: enum_values::<MeadType>(),
        sweetness: enum_values::<SweetnessType>(),
        turbidity: enum_values::<TurbidityType>(),
        effervescence: enum_values::<EffervescenceType>(),
        acidity: enum_values::<AcidityType>(),
        tannins: enum_values::<TanninsType>(),
        body: enum_values::<BodyType>(),
    }
}
