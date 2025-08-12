using DxLibDLL;
using System;
using System.Collections.Generic;

namespace sazanka.App
{
    internal class GridPanel
    {
        /// <summary>
        /// グリッドの基準点を表すワールド座標
        /// </summary>
        public Point Origin { get; set; }

        /// <summary>
        /// 
        /// </summary>
        public Size MapSize { get; set; }

        /// <summary>
        /// 
        /// </summary>
        public Size CellSize { get; set; }

        public GridPanel(Point origin, Size mapSize, Size cellSize)
        {
            Origin = origin;
            MapSize = mapSize;
            CellSize = cellSize;
        }

        public void Update()
        {
            // 横線の描画
            for (int i = 0; i <= MapSize.Height; i++)
            {
                int x1 = Origin.X;
                int x2 = Origin.X + MapSize.Width * CellSize.Width;
                int y = Origin.Y + CellSize.Height * i;

                DX.DrawLine(
                    x1, y,
                    x2, y,
                    DX.GetColor(150, 150, 150));
            }

            // 縦線の描画
            for (int i = 0; i <= MapSize.Width; i++)
            {
                int x = Origin.X + CellSize.Width * i;
                int y1 = Origin.Y;
                int y2 = Origin.Y + MapSize.Width * CellSize.Width;

                DX.DrawLine(
                    x, y1,
                    x, y2,
                    DX.GetColor(150, 150, 150));
            }
        }
    }
}
