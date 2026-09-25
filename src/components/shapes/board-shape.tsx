import { StoredObjectSchemaType } from "@/lib/whiteboard/schemas";
import ArrowShape from "./arrow";
import CircleShape from "./circle";
import PolygonShape from "./polygon";
import RectShape from "./rect";
import TextboxShape from "./textbox";
import type { ToScreen } from "./other-types";

export default function BoardShape({
  obj,
  toScreen,
  zoom,
}: {
  obj: StoredObjectSchemaType;
  toScreen: ToScreen;
  zoom: number;
}) {
  switch (obj.object) {
    case "circle":
      return <CircleShape obj={obj} toScreen={toScreen} zoom={zoom} />;
    case "rect":
      return <RectShape obj={obj} toScreen={toScreen} zoom={zoom} />;
    case "polygon":
      return <PolygonShape obj={obj} toScreen={toScreen} zoom={zoom} />;
    case "arrow":
      return <ArrowShape obj={obj} toScreen={toScreen} zoom={zoom} />;
    case "textbox":
      return <TextboxShape obj={obj} toScreen={toScreen} zoom={zoom} />;
  }
}
