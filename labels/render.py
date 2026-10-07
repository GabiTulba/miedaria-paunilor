"""Label rendering on top of the artwork library (artwork/lib and the sheet
layout in artwork/generators), mirroring what its generator scripts do:
check the text at the print size, then draw the label in its three print
layers and lay each out on an A4 sheet, as SVG and PDF.
"""
import io
import zipfile

import content as label_content
from common import layer_path
from lib import back_label_svg, label_svg
from lib.back_label import dropped_items, text_lines as back_text_lines
from lib.label import text_lines as front_text_lines
from lib.layers import LAYERS
from lib.legibility import legibility_failures
from lib.paths import SGR_SYMBOL_PATH
from lib.sizes import UNITS_PER_MM
from sheet import sheet_documents, svg_to_pdf

MM_PER_UNIT = 1 / UNITS_PER_MM


class RenderError(Exception):
    """Valid content that can't make a label at one size: `code` is
    `does_not_fit` (too wide or too tall for the label, as the artwork
    library reports it) or `illegible` (text below a legal or house
    minimum at its print size)."""

    def __init__(self, code, side, size, detail):
        super().__init__(f'{side} {size}: {code}')
        self.code, self.side, self.size, self.detail = code, side, size, detail

    def to_json(self):
        return {'code': self.code, 'side': self.side, 'size': self.size, 'detail': self.detail}


def _checked(side, size, lines):
    """`lines` (the label's `text_lines()`, a thunk) once they're legible at
    `size`."""
    try:
        text = lines()
    except ValueError as error:
        raise RenderError('does_not_fit', side, size, str(error)) from None
    failures = legibility_failures(text, MM_PER_UNIT)
    if failures:
        raise RenderError('illegible', side, size, [
            {'measure': what, 'printed_mm': round(printed, 2), 'minimum_mm': minimum}
            for what, printed, minimum in failures])


def front(content, size):
    """The front label at `size`, as `(markup_for_layer, dropped)`."""
    options = dict(alcohol_percent=content.alcohol_percent, volume_cl=content.volume_cl, size=size,
                   sweetness=content.sweetness, effervescence=content.effervescence, pre_title=content.pre_title)
    lines = list(content.variant_lines)
    _checked('front', size, lambda: front_text_lines(lines, content.bottling_date, **options))
    return (lambda layer: label_svg(lines, content.stripe_color, content.bottling_date, layer=layer, **options)), ()


def back(content, size):
    """The back label at `size`, as `(markup_for_layer, dropped)`: `dropped`
    names the voluntary extras left off for lack of room."""
    text = (content.producer_name, list(content.address_lines), content.lot_code)
    options = dict(alcohol_percent=content.alcohol_percent, volume_ml=content.volume_ml,
                   contains_sulfites=content.contains_sulfites, sgr_svg_path=SGR_SYMBOL_PATH, size=size)
    _checked('back', size, lambda: back_text_lines(*text, content.qr_url, **options))
    return ((lambda layer: back_label_svg(*text, content.ean, content.qr_url, layer=layer, **options)),
            list(dropped_items(*text, content.qr_url, **options)))


SIDES = {'front': front, 'back': back}


def preview(size, raw_sides):
    """The finished-look label of each side in `raw_sides` (`{side:
    unparsed content or None}`) at `size`: `{side: {'svg', 'dropped'} or
    {'error'}}`, None for an absent side. Each side's content is validated
    on its own, its invalid field being its error."""
    result = {}
    for side, raw in raw_sides.items():
        if raw is None:
            result[side] = None
            continue
        try:
            markup_for_layer, dropped = SIDES[side](label_content.PARSERS[side](raw), size)
            result[side] = {'svg': markup_for_layer('full'), 'dropped': dropped}
        except (label_content.InvalidField, RenderError) as error:
            result[side] = {'error': error.to_json()}
    return result


def bundle(sizes, contents):
    """A ZIP of every side in `contents` at every size in `sizes`, laid out
    like the artwork's output tree: `<side>/<size>/label*.svg` and
    `sheet*.svg/.pdf`, each in the three print layers.

    Raises:
        RenderError: If any of them can't be made (nothing is returned).
    """
    labels = [(side, size, SIDES[side](content, size)[0])
              for side, content in contents.items() if content is not None for size in sizes]
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, 'w', zipfile.ZIP_DEFLATED) as archive:
        for side, size, markup_for_layer in labels:
            folder = f'{side}/{size}'
            layers = {layer: markup_for_layer(layer) for layer in LAYERS}
            for layer, markup in layers.items():
                archive.writestr(f'{folder}/{layer_path("label.svg", layer)}', markup)
            for name, markup in sheet_documents(layers.__getitem__).items():
                archive.writestr(f'{folder}/{name}', markup)
                archive.writestr(f'{folder}/{name.removesuffix(".svg")}.pdf', svg_to_pdf(markup))
    return buffer.getvalue()
