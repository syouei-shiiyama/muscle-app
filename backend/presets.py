# 目標となる体型プリセットの定義

PRESET_TARGETS = {
    "goku": {
        "id": "goku",
        "title": "悟空",
        "subtitle": "がっつり筋肉＋低体脂肪のバキバキタイプ",
        "target_bmi": 27.5,
        "target_fat": 10.0,
    },
    "athlete": {
        "id": "athlete",
        "title": "スマートアスリート",
        "subtitle": "競技向けの細マッチョタイプ",
        "target_bmi": 23.0,
        "target_fat": 13.0,
    },
    "bulk": {
        "id": "bulk",
        "title": "パワーリフター",
        "subtitle": "筋量重視・体重も許容するタイプ",
        "target_bmi": 29.0,
        "target_fat": 18.0,
    },
    "custom": {
        "id": "custom",
        "title": "カスタム",
        "subtitle": "自分で目標を作る",
        "target_bmi": None,   # カスタムは基準ナシ
        "target_fat": None,
    },
}
