import * as L from 'leaflet';
import './OverPassLayer.css';
import './MinZoomIndicator';
import {
  MapWithZoomIndicator,
  MinZoomIndicatorOptions,
} from './MinZoomIndicator';
import * as OverPass from './OverPass';
export declare type OverPassLayerOptions = {
  debug?: boolean;
  minZoom?: number;
  endPoints?: {
    url: string;
    extendQuerySupport: boolean;
    bounds?: [number, number, number, number];
  }[];
  query?: string;
  loadedBounds?: any[];
  markerIcon?: L.Icon | L.DivIcon | null;
  timeout?: number;
  retryOnTimeout?: boolean;
  noInitialRequest?: boolean;
  cacheEnabled?: boolean;
  cacheTTL?: number;
  beforeRequest?(): void;
  afterRequest?(): void;
  onSuccess?(data: OverPass.RootObject): void;
  onError?(): void;
  onTimeout?(): void;
  minZoomIndicatorEnabled?: boolean;
  minZoomIndicatorOptions?: MinZoomIndicatorOptions;
};
export interface IOverPassLayer {
  _markers: any;
  _db: any;
  _loadedBounds: any[];
  _requestInProgress: boolean;
  _responseBoxes: any;
  _nextRequest: any;
  _map?: MapWithZoomIndicator | null;
  _zoomControl: any;
  _data: any;
  _requestBoxes?: L.FeatureGroup<any>;
  _initDB(): Promise<void>;
  _ids: {
    [id: number]: boolean;
  };
  initialize(options: OverPassLayerOptions): void;
  _getPoiPopupHTML(tags: OverPass.Tags, id: number): HTMLDivElement;
  _buildRequestBox(bounds: any): L.Rectangle;
  _addRequestBox(box: L.Rectangle): L.FeatureGroup<any>;
  _getRequestBoxes(): L.Layer[];
  _removeRequestBox(box: any): void;
  _removeRequestBoxes(): any;
  _addResponseBox(box: any): any;
  _addResponseBoxes(requestBoxes: L.Layer[]): void;
  _isFullyLoadedBounds(bounds: any, loadedBounds: any[]): boolean;
  _getLoadedBounds(): any[];
  _addLoadedBounds(bounds: any): void;
  _buildClipsFromBounds(bounds: any[]): any;
  _buildBoundsFromClips(clips: any): any;
  _buildOverpassUrlFromEndPointAndQuery(
    endPoint: {
      url: string;
      extendQuerySupport: boolean;
      bounds?: [number, number, number, number];
    },
    query: string,
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
  _endPointsIndex: number;
  _endPointSupportsBounds(bounds: any): boolean | undefined;
  _onRequestLoad(xhr: any, bounds: any): void;
  _onRequestTimeout(xhr: any, url: any, bounds: any): void;
  _onRequestLoadCallback(bounds: any): void;
  _onRequestErrorCallback(bounds: any): void;
  _onRequestCompleteCallback(bounds: any): void;
  options: Required<OverPassLayerOptions>;
  onAdd(map: L.Map): void;
  onRemove(map: L.Map): void;
  setQuery(query: string): void;
  _resetData(): void;
  getData(): any;
}
const overPassLayer: IOverPassLayer &
  (new (options: OverPassLayerOptions) => IOverPassLayer);
declare module 'leaflet' {
  var OverPassLayer: typeof overPassLayer;
}
export type OverPassLayer = typeof overPassLayer;
export default overPassLayer;
