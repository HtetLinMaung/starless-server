export interface DynamicObject {
    [key: string]: any;
}
export declare const state: DynamicObject;
declare const _default: {
    set: (key: string, value: any) => void;
    setAll: (payload: DynamicObject) => void;
    get: (key: string) => any;
    getAll(): DynamicObject;
};
export default _default;
