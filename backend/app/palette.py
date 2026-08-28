"""카테고리 색 팔레트.

**색은 눈으로 고르지 않는다.** 여기 있는 값은 검증기를 통과한 것이다 — 명도 밴드,
채도 하한, 색맹 구분, 표면 대비. 라이트·다크 밴드 양쪽에 들어가는 값이라 카테고리마다
색을 하나만 저장해도 두 모드에서 다 읽힌다 → docs/stats-rules.md

값을 바꾸려면 검증기를 다시 돌린다. `seed.py` 의 기본 카테고리 색도 이 목록에서 나온다.
"""

from __future__ import annotations

from collections.abc import Iterable

# 순서가 곧 배정 순서다. 임의로 섞지 않는다 — 같은 그룹 안에서 인접한 색이
# 구분되도록 검증한 순서다.
CATEGORICAL_COLORS: tuple[str, ...] = (
    "#3987e5",  # blue
    "#d95926",  # orange
    "#199e70",  # aqua
    "#c98500",  # yellow
    "#d55181",  # magenta
    "#008300",  # green
    "#9085e9",  # violet
    "#e66767",  # red
)


def next_color(used: Iterable[str | None]) -> str:
    """아직 안 쓴 색 중 **가장 앞의 것**을 준다.

    사용자에게 색을 고르게 하지 않는 이유가 여기 있다 — 자유롭게 고르면 검증을
    통과하지 못하는 값이 들어온다. 다 썼으면 처음부터 다시 쓴다. 9번째부터는 색이
    겹치지만, 색 말고도 이름·아이콘이 항상 함께 표시되므로 못 읽게 되지는 않는다.
    """
    taken = {color for color in used if color}
    for color in CATEGORICAL_COLORS:
        if color not in taken:
            return color
    return CATEGORICAL_COLORS[len(taken) % len(CATEGORICAL_COLORS)]
