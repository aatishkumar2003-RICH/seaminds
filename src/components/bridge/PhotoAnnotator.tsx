import { useRef, useEffect, useState, useCallback } from "react";
import { Undo2, Trash2, Send, Pencil, Circle, MoveRight, Type } from "lucide-react";

type Props = {
  imageSrc: string;
  onSubmit: (annotatedDataUrl: string) => void;
  onCancel: () => void;
};

const COLORS = ["#FF0000", "#D4AF37", "#00FF00", "#00BFFF", "#FFFFFF"];
const BRUSH_SIZES = [3, 6, 12];

type DrawPoint = { x: number; y: number };
type Tool = "draw" | "arrow" | "text";

type Annotation =
  | { type: "stroke"; points: DrawPoint[]; color: string; size: number }
  | { type: "arrow"; from: DrawPoint; to: DrawPoint; color: string; size: number }
  | { type: "text"; pos: DrawPoint; text: string; color: string; fontSize: number };

const drawArrowhead = (ctx: CanvasRenderingContext2D, from: DrawPoint, to: DrawPoint, size: number) => {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const headLen = Math.max(size * 4, 14);
  ctx.beginPath();
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - headLen * Math.cos(angle - Math.PI / 6), to.y - headLen * Math.sin(angle - Math.PI / 6));
  ctx.moveTo(to.x, to.y);
  ctx.lineTo(to.x - headLen * Math.cos(angle + Math.PI / 6), to.y - headLen * Math.sin(angle + Math.PI / 6));
  ctx.stroke();
};

const PhotoAnnotator = ({ imageSrc, onSubmit, onCancel }: Props) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState("#FF0000");
  const [brushSize, setBrushSize] = useState(3);
  const [tool, setTool] = useState<Tool>("draw");
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const currentStroke = useRef<DrawPoint[]>([]);
  const arrowStart = useRef<DrawPoint | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [canvasReady, setCanvasReady] = useState(false);
  const [textInput, setTextInput] = useState<{ pos: DrawPoint; value: string } | null>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

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

  const renderAnnotation = useCallback((ctx: CanvasRenderingContext2D, a: Annotation) => {
    if (a.type === "stroke") {
      if (a.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = a.color;
      ctx.lineWidth = a.size;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.moveTo(a.points[0].x, a.points[0].y);
      for (let i = 1; i < a.points.length; i++) ctx.lineTo(a.points[i].x, a.points[i].y);
      ctx.stroke();
    } else if (a.type === "arrow") {
      ctx.beginPath();
      ctx.strokeStyle = a.color;
      ctx.lineWidth = a.size;
      ctx.lineCap = "round";
      ctx.moveTo(a.from.x, a.from.y);
      ctx.lineTo(a.to.x, a.to.y);
      ctx.stroke();
      drawArrowhead(ctx, a.from, a.to, a.size);
    } else if (a.type === "text") {
      const fs = a.fontSize;
      ctx.font = `bold ${fs}px sans-serif`;
      ctx.fillStyle = a.color;
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 3;
      ctx.strokeText(a.text, a.pos.x, a.pos.y);
      ctx.fillText(a.text, a.pos.x, a.pos.y);
    }
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = imgRef.current;
    if (!canvas || !ctx || !img) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    for (const a of annotations) renderAnnotation(ctx, a);
  }, [annotations, renderAnnotation]);

  useEffect(() => {
    if (canvasReady) redraw();
  }, [canvasReady, redraw]);

  useEffect(() => {
    if (textInput && textInputRef.current) textInputRef.current.focus();
  }, [textInput]);

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

  const arrowEnd = useRef<DrawPoint | null>(null);

  const startDrawFixed = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    const pos = getPos(e);
    if (!pos) return;
    if (tool === "text") {
      setTextInput({ pos, value: "" });
      return;
    }
    if (tool === "arrow") {
      arrowStart.current = pos;
      arrowEnd.current = pos;
      setIsDrawing(true);
      return;
    }
    setIsDrawing(true);
    currentStroke.current = [pos];
  };

  const moveDrawFixed = (e: React.TouchEvent | React.MouseEvent) => {
    e.preventDefault();
    if (!isDrawing) return;
    const pos = getPos(e);
    if (!pos) return;

    if (tool === "arrow" && arrowStart.current) {
      arrowEnd.current = pos;
      redraw();
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!ctx) return;
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = brushSize;
      ctx.lineCap = "round";
      ctx.moveTo(arrowStart.current.x, arrowStart.current.y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      drawArrowhead(ctx, arrowStart.current, pos, brushSize);
      return;
    }

    currentStroke.current.push(pos);
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

  const endDrawFixed = () => {
    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === "arrow" && arrowStart.current && arrowEnd.current) {
      const dist = Math.hypot(arrowEnd.current.x - arrowStart.current.x, arrowEnd.current.y - arrowStart.current.y);
      if (dist > 5) {
        setAnnotations(prev => [...prev, {
          type: "arrow",
          from: { ...arrowStart.current! },
          to: { ...arrowEnd.current! },
          color,
          size: brushSize,
        }]);
      }
      arrowStart.current = null;
      arrowEnd.current = null;
      return;
    }

    if (tool === "draw" && currentStroke.current.length > 0) {
      setAnnotations(prev => [...prev, { type: "stroke", points: [...currentStroke.current], color, size: brushSize }]);
    }
    currentStroke.current = [];
  };

  const commitText = () => {
    if (!textInput || !textInput.value.trim()) {
      setTextInput(null);
      return;
    }
    const fontSize = brushSize === 3 ? 16 : brushSize === 6 ? 22 : 30;
    setAnnotations(prev => [...prev, {
      type: "text",
      pos: textInput.pos,
      text: textInput.value.trim(),
      color,
      fontSize,
    }]);
    setTextInput(null);
  };

  const undo = () => {
    setAnnotations(prev => {
      const next = prev.slice(0, -1);
      setTimeout(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        const img = imgRef.current;
        if (!canvas || !ctx || !img) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        for (const a of next) renderAnnotation(ctx, a);
      }, 0);
      return next;
    });
  };

  const clearAll = () => {
    setAnnotations([]);
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    const img = imgRef.current;
    if (!canvas || !ctx || !img) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  };

  const handleSubmit = () => {
    redraw(); // ensure final state
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSubmit(canvas.toDataURL("image/jpeg", 0.9));
  };

  const TOOLS: { id: Tool; icon: typeof Pencil; label: string }[] = [
    { id: "draw", icon: Pencil, label: "Draw" },
    { id: "arrow", icon: MoveRight, label: "Arrow" },
    { id: "text", icon: Type, label: "Text" },
  ];

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
      <div ref={containerRef} className="flex-1 overflow-hidden flex items-center justify-center px-4 py-3 relative">
        <canvas
          ref={canvasRef}
          className="rounded-xl touch-none"
          style={{ maxWidth: "100%", maxHeight: "100%", cursor: tool === "text" ? "text" : "crosshair" }}
          onMouseDown={startDrawFixed}
          onMouseMove={moveDrawFixed}
          onMouseUp={endDrawFixed}
          onMouseLeave={endDrawFixed}
          onTouchStart={startDrawFixed}
          onTouchMove={moveDrawFixed}
          onTouchEnd={endDrawFixed}
        />
        {/* Text input overlay */}
        {textInput && canvasRef.current && (() => {
          const canvas = canvasRef.current!;
          const rect = canvas.getBoundingClientRect();
          const scaleX = rect.width / canvas.width;
          const scaleY = rect.height / canvas.height;
          const left = rect.left - (containerRef.current?.getBoundingClientRect().left || 0) + textInput.pos.x * scaleX;
          const top = rect.top - (containerRef.current?.getBoundingClientRect().top || 0) + textInput.pos.y * scaleY;
          return (
            <div className="absolute" style={{ left, top, zIndex: 10 }}>
              <input
                ref={textInputRef}
                value={textInput.value}
                onChange={e => setTextInput({ ...textInput, value: e.target.value })}
                onKeyDown={e => { if (e.key === "Enter") commitText(); if (e.key === "Escape") setTextInput(null); }}
                onBlur={commitText}
                className="bg-black/70 text-white border rounded px-2 py-1 text-sm outline-none"
                style={{ borderColor: color, color, minWidth: 100 }}
                placeholder="Type label..."
              />
            </div>
          );
        })()}
      </div>

      {/* Toolbar */}
      <div className="px-4 py-3 border-t border-border space-y-3">
        {/* Tool selector */}
        <div className="flex items-center gap-1 justify-center">
          {TOOLS.map(t => {
            const Icon = t.icon;
            const active = tool === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTool(t.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                style={{
                  background: active ? "rgba(212,175,55,0.2)" : "transparent",
                  border: active ? "1px solid #D4AF37" : "1px solid rgba(255,255,255,0.1)",
                  color: active ? "#D4AF37" : "rgba(255,255,255,0.5)",
                }}
              >
                <Icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>

        {/* Colors + sizes */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
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
            disabled={annotations.length === 0}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm text-muted-foreground border border-border disabled:opacity-30 transition-colors"
          >
            <Undo2 size={14} /> Undo
          </button>
          <button
            onClick={clearAll}
            disabled={annotations.length === 0}
            className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm text-muted-foreground border border-border disabled:opacity-30 transition-colors"
          >
            <Trash2 size={14} /> Clear
          </button>
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          {tool === "draw" ? "Draw freehand to highlight areas of concern" :
           tool === "arrow" ? "Drag to draw an arrow pointing to equipment" :
           "Tap anywhere to add a text label"}
        </p>
      </div>
    </div>
  );
};

export default PhotoAnnotator;
