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

fn map_enum_values<E: Serialize>(all: Vec<E>) -> Vec<EnumValue> {
    all.into_iter()
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
        mead_type: map_enum_values(MeadType::all()),
        sweetness: map_enum_values(SweetnessType::all()),
        turbidity: map_enum_values(TurbidityType::all()),
        effervescence: map_enum_values(EffervescenceType::all()),
        acidity: map_enum_values(AcidityType::all()),
        tanins: map_enum_values(TaninsType::all()),
        body: map_enum_values(BodyType::all()),
    }
}
