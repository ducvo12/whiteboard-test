import { StoredObjectSchemaValue } from "@/lib/whiteboard/schemas";
import CircleShape from "./circle";
import PolygonShape from "./polygon";
import RectShape from "./rect";
import type { ToScreen } from "./other-types";

export default function BoardShape({
  obj,
  toScreen,
  zoom,
}: {
  obj: StoredObjectSchemaValue;
  toScreen: ToScreen;
  zoom: number;
}) {
  switch (obj.shape) {
    case "circle":
      return <CircleShape obj={obj} toScreen={toScreen} zoom={zoom} />;
    case "rect":
      return <RectShape obj={obj} toScreen={toScreen} zoom={zoom} />;
    case "polygon":
      return <PolygonShape obj={obj} toScreen={toScreen} zoom={zoom} />;
  }
}
