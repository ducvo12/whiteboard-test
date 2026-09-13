import CircleShape from "./circle";
import PolygonShape from "./polygon";
import RectShape from "./rect";
import type { BoardObject, ToScreen } from "./types";

export default function BoardShape({
  obj,
  toScreen,
}: {
  obj: BoardObject;
  toScreen: ToScreen;
}) {
  switch (obj.shape) {
    case "circle":
      return <CircleShape obj={obj} toScreen={toScreen} />;
    case "rect":
      return <RectShape obj={obj} toScreen={toScreen} />;
    case "polygon":
      return <PolygonShape obj={obj} toScreen={toScreen} />;
  }
}
