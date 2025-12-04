# backend/presets.py

PRESET_TARGETS = [
    {
        "id": "goku",
        "name": "悟空",
        "description": "がっつり筋肉＋低体脂肪のバキバキタイプ",
        "default": {
            "target_bmi": 24.0,
            "target_body_fat": 10.0,
        },
    },
    {
        "id": "athlete",
        "name": "スマートアスリート",
        "description": "競技向けの細マッチョタイプ",
        "default": {
            "target_bmi": 22.0,
            "target_body_fat": 12.0,
        },
    },
    {
        "id": "bulk",
        "name": "パワーリフター",
        "description": "筋量重視・体重も許容",
        "default": {
            "target_bmi": 27.0,
            "target_body_fat": 18.0,
        },
    },
]
