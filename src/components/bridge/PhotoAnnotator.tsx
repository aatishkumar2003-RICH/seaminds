import { useRef, useEffect, useState, useCallback } from "react";
import { Undo2, Trash2, Send, Pencil, Circle } from "lucide-react";

type Props = {
  imageSrc: string;
  onSubmit: (annotatedDataUrl: string) => void;
  onCancel: () => void;
};

const COLORS = ["#FF0000", "#D4AF37", "#00FF00", "#00BFFF", "#FFFFFF"];
const BRUSH_SIZES = [3, 6, 12];

type DrawPoint = { x: number; y: number };
type Stroke = { points: DrawPoint[]; color: string; size: number };

const PhotoAnnotator = ({ imageSrc, onSubmit, onCancel }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#FF0000");
  const [brushSize, setBrushSize] = useState(3);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const currentStroke = useRef<DrawPoint[]>([]);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);

  // Load image and set canvas dimensions
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      imgRef.current = img;
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      const maxW = container.clientWidth;
      const maxH = 400;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      setCanvasReady(true);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = imgRef.current;
    if (!canvas || !ctx || !img) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.strokeStyle = stroke.color;
      ctx.lineWidth = stroke.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }
  }, [strokes]);

  useEffect(() => {
    if (canvasReady) redraw();
  }, [canvasReady, redraw]);

  const getPos = (e: React.TouchEvent | React.MouseEvent): DrawPoint | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    setIsDrawing(true);
    currentStroke.current = [pos];
  };

  const moveDraw = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const pos = getPos(e);
    if (!pos) return;
    currentStroke.current.push(pos);

    // Live preview
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!ctx || currentStroke.current.length < 2) return;
    const pts = currentStroke.current;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
    ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
    ctx.stroke();
  };

  const endDraw = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    if (currentStroke.current.length > 0) {
      setStrokes(prev => [...prev, { points: [...currentStroke.current], color, size: brushSize }]);
    }
    currentStroke.current = [];
  };

  const undo = () => {
    setStrokes(prev => {
      const next = prev.slice(0, -1);
      // Redraw after state update
      setTimeout(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        const img = imgRef.current;
        if (!canvas || !ctx || !img) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        for (const stroke of next) {
          if (stroke.points.length < 2) continue;
          ctx.beginPath();
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.size;
          ctx.lineCap = "round";
          ctx.lineJoin = "round";
          ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
          for (let i = 1; i < stroke.points.length; i++) {
            ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
          }
          ctx.stroke();
        }
      }, 0);
      return next;
    });
  };

  const clearAll = () => {
    setStrokes([]);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = imgRef.current;
    if (!canvas || !ctx || !img) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };

  const handleSubmit = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSubmit(canvas.toDataURL("image/jpeg", 0.9));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={onCancel} className="text-sm text-muted-foreground">Cancel</button>
        <h2 className="text-sm font-bold" style={{ color: "#D4AF37" }}>ANNOTATE PHOTO</h2>
        <button
          onClick={handleSubmit}
          className="flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg"
          style={{ background: "#D4AF37", color: "#0D1B2A" }}
        >
          <Send size={14} /> Diagnose
        </button>
      </div>

      {/* Canvas */}
      <div ref={containerRef} className="flex-1 overflow-hidden flex items-center justify-center px-4 py-3">
        <canvas
          ref={canvasRef}
          className="rounded-xl touch-none"
          style={{ maxWidth: "100%", maxHeight: "100%", cursor: "crosshair" }}
          onMouseDown={startDraw}
          onMouseMove={moveDraw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={moveDraw}
          onTouchEnd={endDraw}
        />
      </div>

      {/* Toolbar */}
      <div className="px-4 py-3 border-t border-border space-y-3">
        {/* Colors */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Pencil size={14} className="text-muted-foreground mr-1" />
            {COLORS.map(c => (
              <button
                key={c}
                onClick={() => setColor(c)}
                className="rounded-full transition-all"
                style={{
                  width: color === c ? 28 : 22,
                  height: color === c ? 28 : 22,
                  background: c,
                  border: color === c ? "2px solid white" : "1px solid rgba(255,255,255,0.3)",
                }}
              />
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <Circle size={14} className="text-muted-foreground" />
            {BRUSH_SIZES.map(s => (
              <button
                key={s}
                onClick={() => setBrushSize(s)}
                className="rounded-full bg-foreground transition-all"
                style={{
                  width: s + 10,
                  height: s + 10,
                  opacity: brushSize === s ? 1 : 0.4,
                  border: brushSize === s ? "1px solid #D4AF37" : "none",
                }}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={undo}
            disabled={strokes.length === 0}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm text-muted-foreground border border-border disabled:opacity-30 transition-colors"
          >
            <Undo2 size={14} /> Undo
          </button>
          <button
            onClick={clearAll}
            disabled={strokes.length === 0}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm text-muted-foreground border border-border disabled:opacity-30 transition-colors"
          >
            <Trash2 size={14} /> Clear
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          Draw on the photo to highlight alarms, gauges, or areas of concern
        </p>
      </div>
    </div>
  );
};

export default PhotoAnnotator;
