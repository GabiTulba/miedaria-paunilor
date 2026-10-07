"""Parsing and validation of label requests.

Everything a request carries is checked here, before any drawing: types,
lengths, formats, and that every character has a glyph in the label font,
so a bad field is reported by name instead of failing deep in the artwork
library. Lengths are capped well above what fits on a label, which only
bounds the work a request can cause; whether the text fits is the
artwork's own check (see render.py).
"""
import re
from dataclasses import dataclass

from lib import SIZES
from lib.ean13 import ean13_normalize
from lib.label import BODY_FONT_WEIGHT
from lib.outline import _font_data
from lib.paths import FONT_BODY, FONT_BODY_ITALIC

MAX_LINE_CHARS = 100
MAX_SHORT_CHARS = 40
MAX_URL_CHARS = 200
MAX_LINES = 2

HEX_COLOR = re.compile(r'#[0-9a-fA-F]{6}')
ALCOHOL_PERCENT = re.compile(r'\d{1,2}(,\d)?')
VOLUME_CL = re.compile(r'\d{1,3}(,\d)?')
VOLUME_ML = re.compile(r'\d{1,4}')
EAN = re.compile(r'\d{12,13}')
URL = re.compile(r'https?://[!-~]+')       # printable ASCII, no spaces


class InvalidField(Exception):
    """A request field that can't be used: `field` is its dotted path (e.g.
    `back.ean`), `problem` a short code the admin UI translates."""

    def __init__(self, field, problem, detail=None):
        super().__init__(f'{field}: {problem}')
        self.field, self.problem, self.detail = field, problem, detail

    def to_json(self):
        detail = None if self.detail is None else str(self.detail)
        return {'code': 'invalid_field', 'field': self.field, 'problem': self.problem, 'detail': detail}


@dataclass(frozen=True)
class FrontContent:
    pre_title: str | None
    variant_lines: tuple
    sweetness: str
    effervescence: str | None
    stripe_color: str
    bottling_date: str
    alcohol_percent: str
    volume_cl: str | None


@dataclass(frozen=True)
class BackContent:
    producer_name: str
    address_lines: tuple
    lot_code: str
    ean: str
    qr_url: str
    alcohol_percent: str
    volume_ml: str | None
    contains_sulfites: bool


def _object(value, field):
    if not isinstance(value, dict):
        raise InvalidField(field, 'type')
    return value


def _string(data, field, path, max_chars):
    """A required, trimmed string."""
    value = data.get(field)
    if not isinstance(value, str):
        raise InvalidField(path, 'type')
    value = value.strip()
    if not value:
        raise InvalidField(path, 'required')
    if len(value) > max_chars:
        raise InvalidField(path, 'too_long', max_chars)
    return value


def _text(data, field, path, max_chars=MAX_LINE_CHARS, font=FONT_BODY, capitals=False):
    """A line of label text: `_string()`, every character - in capitals,
    if the label sets it so - in `font`."""
    value = _string(data, field, path, max_chars)
    cmap = _font_data(font, BODY_FONT_WEIGHT)[1]
    unsupported = next((c for c in (value.upper() if capitals else value)
                        if not c.isprintable() or ord(c) not in cmap), None)
    if unsupported is not None:
        raise InvalidField(path, 'unsupported_character', unsupported)
    return value


def _optional_text(data, field, path, max_chars, capitals=False):
    return None if data.get(field) is None else _text(data, field, path, max_chars, capitals=capitals)


def _lines(data, field, path, font=FONT_BODY):
    value = data.get(field)
    if not isinstance(value, list):
        raise InvalidField(path, 'type')
    if not 1 <= len(value) <= MAX_LINES:
        raise InvalidField(path, 'line_count', MAX_LINES)
    return tuple(_text({field: line}, field, f'{path}.{index}', font=font) for index, line in enumerate(value))


def _matching(data, field, path, pattern, max_chars=MAX_SHORT_CHARS):
    value = _string(data, field, path, max_chars)
    if not pattern.fullmatch(value):
        raise InvalidField(path, 'format')
    return value


def _optional_matching(data, field, path, pattern):
    return None if data.get(field) is None else _matching(data, field, path, pattern)


def _ean(data, path):
    value = _matching(data, 'ean', path, EAN)
    try:
        return ean13_normalize(value)
    except ValueError:
        raise InvalidField(path, 'check_digit') from None


def _lot_code(data, path):
    value = _text(data, 'lot_code', path, MAX_SHORT_CHARS)
    if not value.startswith('L') or len(value) < 2:   # Directive 2011/91/UE: "L" then the batch
        raise InvalidField(path, 'format')
    return value


def front_content(value, path='front'):
    data = _object(value, path)
    return FrontContent(
        pre_title=_optional_text(data, 'pre_title', f'{path}.pre_title', MAX_SHORT_CHARS, capitals=True),
        variant_lines=_lines(data, 'variant_lines', f'{path}.variant_lines', FONT_BODY_ITALIC),
        sweetness=_text(data, 'sweetness', f'{path}.sweetness', MAX_SHORT_CHARS),
        effervescence=_optional_text(data, 'effervescence', f'{path}.effervescence', MAX_SHORT_CHARS),
        stripe_color=_matching(data, 'stripe_color', f'{path}.stripe_color', HEX_COLOR),
        bottling_date=_text(data, 'bottling_date', f'{path}.bottling_date', MAX_SHORT_CHARS),
        alcohol_percent=_matching(data, 'alcohol_percent', f'{path}.alcohol_percent', ALCOHOL_PERCENT),
        volume_cl=_optional_matching(data, 'volume_cl', f'{path}.volume_cl', VOLUME_CL))


def back_content(value, path='back'):
    data = _object(value, path)
    contains_sulfites = data.get('contains_sulfites')
    if not isinstance(contains_sulfites, bool):
        raise InvalidField(f'{path}.contains_sulfites', 'type')
    return BackContent(
        producer_name=_text(data, 'producer_name', f'{path}.producer_name'),
        address_lines=_lines(data, 'address_lines', f'{path}.address_lines'),
        lot_code=_lot_code(data, f'{path}.lot_code'),
        ean=_ean(data, f'{path}.ean'),
        qr_url=_matching(data, 'qr_url', f'{path}.qr_url', URL, MAX_URL_CHARS),
        alcohol_percent=_matching(data, 'alcohol_percent', f'{path}.alcohol_percent', ALCOHOL_PERCENT),
        volume_ml=_optional_matching(data, 'volume_ml', f'{path}.volume_ml', VOLUME_ML),
        contains_sulfites=contains_sulfites)


def _size(value, path):
    if value not in SIZES:
        raise InvalidField(path, 'unknown_size')
    return value


PARSERS = {'front': front_content, 'back': back_content}


def _raw_sides(data):
    """`{side: unparsed content or None}`, at least one side given."""
    sides = {side: data.get(side) for side in PARSERS}
    if all(raw is None for raw in sides.values()):
        raise InvalidField('front', 'required')
    return sides


def preview_request(value):
    """`(size, {side: unparsed content or None})` of a preview request: each
    side is parsed on its own (`PARSERS`), so one side's invalid field
    doesn't hide the other side's preview."""
    data = _object(value, 'request')
    return _size(data.get('size'), 'size'), _raw_sides(data)


def bundle_request(value):
    """`(sizes, {side: content or None})` of a bundle request; sizes in
    `SIZES` order."""
    data = _object(value, 'request')
    sizes = data.get('sizes')
    if not isinstance(sizes, list) or not sizes:
        raise InvalidField('sizes', 'required')
    chosen = {_size(size, f'sizes.{index}') for index, size in enumerate(sizes)}
    contents = {side: None if raw is None else PARSERS[side](raw) for side, raw in _raw_sides(data).items()}
    return [size for size in SIZES if size in chosen], contents
