import * as L from "leaflet";

type MinZoomIndicatorOptions = {
  minZoom?: number;
  minZoomMessageNoLayer?: string;
  minZoomMessage?: string;
} & L.ControlOptions;

export interface MapWithZoomIndicator extends L.Map {
  zoomIndicator?: IMinZoomIndicator;
}
interface IMinZoomIndicator {
  _map?: MapWithZoomIndicator | null;
  _container: HTMLElement;
  options: MinZoomIndicatorOptions;
  _layers: { [id: string]: number | null };
  initialize(options: MinZoomIndicatorOptions): void;
  _addLayer(layer: any): void;
  _removeLayer(layer: any): void;
  _getMinZoomLevel(): number;
  _updateBox(event: L.LeafletEvent | null): void;
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

  _updateBox(event: L.LeafletEvent) {
    const minZoomLevel = this._getMinZoomLevel();

    if (event !== null) {
      L.DomEvent.preventDefault(event as any);
    }

    if (!this._container || !this._map) throw "Unexpected undefined";

    if (minZoomLevel === -1) {
      this._container.innerHTML = this.options.minZoomMessageNoLayer + "";
    } else {
      this._container.innerHTML = (this.options.minZoomMessage || "")
        .replace(/CURRENTZOOM/, this._map.getZoom() + "")
        .replace(/MINZOOMLEVEL/, minZoomLevel + "");
    }

    if (this._map.getZoom() >= minZoomLevel) {
      this._container.style.display = "none";
    } else {
      this._container.style.display = "block";
    }
  },

  onAdd(map: L.Map) {
    this._map = map;

    this._map.zoomIndicator = this;

    this._container = L.DomUtil.create(
      "div",
      "leaflet-control-minZoomIndicator"
    );

    this._map.on("moveend", this._updateBox, this);

    this._updateBox(null);

    return this._container;
  },

  onRemove(map: L.Map) {
    (L.Control as any).prototype.onRemove.call(this, map);

    map.off(
      {
        moveend: this._updateBox
      },
      this
    );

    this._map = null;
  }
} as IMinZoomIndicator);

export default MinZoomIndicator;
