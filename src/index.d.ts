import * as L from "leaflet";
import * as OverPass from "./OverPass";
declare module "leaflet" {
  export type OverPassLayerOptions = {
    debug?: boolean;
    minZoom?: number;
    endPoints?: {
      url: string;
      extendQuerySupport: boolean;
      bounds?: number[];
    }[];
    query?: string;
    loadedBounds?: number[];
    markerIcon?: null;
    timeout?: number;
    retryOnTimeout?: boolean;
    noInitialRequest?: boolean;
    cacheEnabled?: boolean;
    cacheTTL?: number;
    beforeRequest?(): void;
    afterRequest?(): void;
    onSuccess?(data: OverPass.RootObject[]): void;
    onError?(): void;
    onTimeout?(): void;
    minZoomIndicatorEnabled?: boolean;
    minZoomIndicatorOptions?: {
      minZoomMessageNoLayer?: string;
      minZoomMessage?: string;
    };
  };

  export interface IOverPassLayer {
    _initDB(): Promise<void>;
    initialize(options: OverPassLayerOptions): void;
    _getPoiPopupHTML(tags: any, id: any): HTMLDivElement;
    _buildRequestBox(bounds: any): any;
    _addRequestBox(box: any): any;
    _getRequestBoxes(): any;
    _removeRequestBox(box: any): void;
    _removeRequestBoxes(): any;
    _addResponseBox(box: any): any;
    _addResponseBoxes(requestBoxes: any): void;
    _isFullyLoadedBounds(bounds: any, loadedBounds: any): boolean;
    _getLoadedBounds(): any;
    _addLoadedBounds(bounds: any): void;
    _buildClipsFromBounds(bounds: any): any;
    _buildBoundsFromClips(clips: any): any;
    _buildOverpassUrlFromEndPointAndQuery(
      endPoint: any,
      query: any,
      bounds: any
    ): string;
    _buildLargerBounds(bounds: any): any;
    _setRequestInProgress(isInProgress: any): void;
    _isRequestInProgress(): any;
    _hasNextRequest(): boolean;
    _getNextRequest(): any;
    _setNextRequest(nextRequest: any): void;
    _removeNextRequest(): void;
    _prepareRequest(): false | undefined;
    _retry(bounds: any): void;
    _nextEndPoint(requestBounds: any): void;
    _sendRequest(bounds: any): void;
    _endPointSupportsBounds(bounds: any): boolean | undefined;
    _onRequestLoad(xhr: any, bounds: any): void;
    _onRequestTimeout(xhr: any, url: any, bounds: any): void;
    _onRequestLoadCallback(bounds: any): void;
    _onRequestErrorCallback(bounds: any): void;
    _onRequestCompleteCallback(): void;
    onAdd(map: any): void;
    onRemove(map: any): void;
    setQuery(query: any): void;
    _resetData(): void;
    getData(): any;
  }

  export var OverPassLayer: (new (...args: any[]) => IOverPassLayer) &
    typeof L.FeatureGroup;

  export var overPassLayer: IOverPassLayer & L.FeatureGroup;

  export namespace Control {
    export type MinZoomIndicatorOptions = {
      minZoom?: number;
      minZoomMessageNoLayer?: string;
      minZoomMessage?: string;
    } & L.ControlOptions;

    export interface IMinZoomIndicator {
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

    export var MinZoomIndicator: (new (...args: any[]) => IMinZoomIndicator) &
      typeof L.Control;
  }
}
