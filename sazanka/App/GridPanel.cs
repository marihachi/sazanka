using DxLibDLL;
using System;
using System.Collections.Generic;
using System.Drawing;

namespace sazanka.App
{
    internal class GridPanel
    {
        /// <summary>
        /// グリッドの基準点を表す絶対座標
        /// </summary>
        public Point Location { get; set; }

        /// <summary>
        /// スクリーンの基準点を表す絶対座標
        /// </summary>
        public Point ScreenOrigin { get; set; }

        /// <summary>
        /// 
        /// </summary>
        public Size MapSize { get; set; }

        /// <summary>
        /// 
        /// </summary>
        public Size CellSize { get; set; }

        public GridPanel(Point location, Size mapSize, Size cellSize)
        {
            Location = location;
            MapSize = mapSize;
            CellSize = cellSize;
        }

        public void Update()
        {
            // 横線の描画
            for (int i = 0; i <= MapSize.Height; i++)
            {
                var p1 = new Point(
                    Location.X,
                    Location.Y + CellSize.Height * i);

                var p2 = new Point(
                    Location.X + MapSize.Width * CellSize.Width,
                    Location.Y + CellSize.Height * i);

                var rel1 = PointUtility.ConvertAbsToRel(p1, ScreenOrigin);
                var rel2 = PointUtility.ConvertAbsToRel(p2, ScreenOrigin);

                DX.DrawLine(
                    rel1.X,
                    rel1.Y,
                    rel2.X,
                    rel2.Y,
                    DX.GetColor(150, 150, 150));
            }

            // 縦線の描画
            for (int i = 0; i <= MapSize.Width; i++)
            {
                var p1 = new Point(
                    Location.X + CellSize.Width * i,
                    Location.Y);

                var p2 = new Point(
                    Location.X + CellSize.Width * i,
                    Location.Y + MapSize.Width * CellSize.Width);

                var rel1 = PointUtility.ConvertAbsToRel(p1, ScreenOrigin);
                var rel2 = PointUtility.ConvertAbsToRel(p2, ScreenOrigin);

                DX.DrawLine(
                    rel1.X,
                    rel1.Y,
                    rel2.X,
                    rel2.Y,
                    DX.GetColor(150, 150, 150));
            }
        }
    }
}
