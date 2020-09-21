import * as L from "leaflet";

type MinZoomIndicatorOptions = {
  minZoom?: number;
  minZoomMessageNoLayer?: string;
  minZoomMessage?: string;
} & L.ControlOptions;

interface IMinZoomIndicator {
  options: MinZoomIndicatorOptions;
  _layers: { [id: string]: number | null };
  initialize(options: MinZoomIndicatorOptions): void;
  _addLayer(layer: any): void;
  _removeLayer(layer: any): void;
  _getMinZoomLevel(): number;
  _updateBox(event: any): void;
  onAdd(map: L.Map): HTMLElement;
  onRemove(map: L.Map): void;
}

const MinZoomIndicator = L.Control.extend<IMinZoomIndicator>({
  options: {},

  _layers: {},

  initialize(options: MinZoomIndicatorOptions) {
    L.Util.setOptions(this, options);

    this._layers = {};
  },

  _addLayer(layer: any) {
    let minZoom = 15;

    if (layer.options.minZoom) {
      minZoom = layer.options.minZoom;
    }

    this._layers[layer._leaflet_id] = minZoom;

    this._updateBox(null);
  },

  _removeLayer(layer: any) {
    this._layers[layer._leaflet_id] = null;

    this._updateBox(null);
  },

  _getMinZoomLevel() {
    let minZoomLevel = -1;

    for (const key in this._layers) {
      if (
        this._layers[key] !== null &&
        (this._layers[key] as number) > minZoomLevel
      ) {
        minZoomLevel = this._layers[key] as number;
      }
    }

    return minZoomLevel;
  },

  _updateBox(event: any) {
    const minZoomLevel = this._getMinZoomLevel();

    if (event !== null) {
      L.DomEvent.preventDefault(event);
    }

    if (minZoomLevel === -1) {
      (this as any)._container.innerHTML = this.options.minZoomMessageNoLayer;
    } else {
      (this as any)._container.innerHTML = (this.options.minZoomMessage || "")
        .replace(/CURRENTZOOM/, (this as any)._map.getZoom())
        .replace(/MINZOOMLEVEL/, minZoomLevel + "");
    }

    if ((this as any)._map.getZoom() >= minZoomLevel) {
      (this as any)._container.style.display = "none";
    } else {
      (this as any)._container.style.display = "block";
    }
  },

  onAdd(map: any) {
    (this as any)._map = map;

    (this as any)._map.zoomIndicator = this;

    (this as any)._container = L.DomUtil.create(
      "div",
      "leaflet-control-minZoomIndicator"
    );

    (this as any)._map.on("moveend", this._updateBox, this);

    this._updateBox(null);

    return (this as any)._container;
  },

  onRemove(map: any) {
    (L.Control as any).prototype.onRemove.call(this, map);

    map.off(
      {
        moveend: this._updateBox
      },
      this
    );

    (this as any)._map = null;
  }
} as IMinZoomIndicator);

export default MinZoomIndicator;
