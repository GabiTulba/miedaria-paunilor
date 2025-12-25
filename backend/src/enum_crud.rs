use serde::{Deserialize, Serialize};

use crate::enums::*;

#[derive(Debug, Serialize, Deserialize)]
pub struct EnumValue {
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EnumValues {
    pub mead_type: Vec<EnumValue>,
    pub sweetness: Vec<EnumValue>,
    pub turbidity: Vec<EnumValue>,
    pub effervescence: Vec<EnumValue>,
    pub acidity: Vec<EnumValue>,
    pub tanins: Vec<EnumValue>,
    pub body: Vec<EnumValue>,
}

fn map_enum_values<E>(
    all: Vec<E>,
    as_str: impl Fn(&E) -> &'static str,
) -> Vec<EnumValue> {
    all.into_iter()
        .map(|e| EnumValue {
            value: as_str(&e).to_string(),
        })
        .collect()
}

pub fn get_all_enum_values() -> EnumValues {
    EnumValues {
        mead_type: map_enum_values(
            MeadType::all(),
            |e| e.as_str(),
        ),
        sweetness: map_enum_values(
            SweetnessType::all(),
            |e| e.as_str(),
        ),
        turbidity: map_enum_values(
            TurbidityType::all(),
            |e| e.as_str(),
        ),
        effervescence: map_enum_values(
            EffervescenceType::all(),
            |e| e.as_str(),
        ),
        acidity: map_enum_values(
            AcidityType::all(),
            |e| e.as_str(),
        ),
        tanins: map_enum_values(
            TaninsType::all(),
            |e| e.as_str(),
        ),
        body: map_enum_values(
            BodyType::all(),
            |e| e.as_str(),
        ),
    }
}
