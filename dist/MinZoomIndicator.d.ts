import * as L from "leaflet";
declare type MinZoomIndicatorOptions = {
    minZoom?: number;
    minZoomMessageNoLayer?: string;
    minZoomMessage?: string;
} & L.ControlOptions;
interface IMinZoomIndicator {
    options: MinZoomIndicatorOptions;
    _layers: {
        [id: string]: number | null;
    };
    initialize(options: MinZoomIndicatorOptions): void;
    _addLayer(layer: any): void;
    _removeLayer(layer: any): void;
    _getMinZoomLevel(): number;
    _updateBox(event: any): void;
    onAdd(map: L.Map): HTMLElement;
    onRemove(map: L.Map): void;
}
declare const MinZoomIndicator: (new (...args: any[]) => IMinZoomIndicator) & typeof L.Control;
export default MinZoomIndicator;
