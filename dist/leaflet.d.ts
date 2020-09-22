import overPassLayer from "./index";
declare module "leaflet" {
    var OverPassLayer: typeof overPassLayer;
}
