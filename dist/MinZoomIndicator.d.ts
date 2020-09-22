import * as L from "leaflet";
export declare type MinZoomIndicatorOptions = {
    minZoom?: number;
    minZoomMessageNoLayer?: string;
    minZoomMessage?: string;
} & L.ControlOptions;
export interface MapWithZoomIndicator extends L.Map {
    zoomIndicator?: IMinZoomIndicator;
}
export interface IMinZoomIndicator {
    _map?: MapWithZoomIndicator | null;
    _container: HTMLElement;
    options: MinZoomIndicatorOptions;
    _layers: {
        [id: string]: number | null;
    };
    initialize(options: MinZoomIndicatorOptions): void;
    _addLayer(layer: any): void;
    _removeLayer(layer: any): void;
    _getMinZoomLevel(): number;
    _updateBox(event: L.LeafletEvent | null): void;
    onAdd(map: L.Map): HTMLElement;
    onRemove(map: L.Map): void;
}
declare const minZoomIndicator: (new (...args: any[]) => IMinZoomIndicator) & typeof L.Control;
declare module "leaflet" {
    module Control {
        var MinZoomIndicator: typeof minZoomIndicator;
    }
}
export default minZoomIndicator;
