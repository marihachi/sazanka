using DxLibDLL;
using System;
using System.Collections.Generic;
using System.Drawing;

namespace sazanka.App
{
    internal class GridPanel
    {
        /// <summary>
        /// 列の数を表す
        /// </summary>
        public int ColumnsCount { get; set; }

        /// <summary>
        /// 行の数を表す
        /// </summary>
        public int RowsCount { get; set; }

        /// <summary>
        /// 1つのセルのサイズ
        /// </summary>
        public Size CellSize { get; set; }

        /// <summary>
        /// コントロールの表示エリア
        /// </summary>
        public Rectangle ControlArea { get; set; }

        /// <summary>
        /// 現在表示している領域の基準点
        /// </summary>
        public Point ViewportOrigin { get; set; }

        public GridPanel(int columnsCount, int rowsCount, Size cellSize, Rectangle controlArea)
        {
            ColumnsCount = columnsCount;
            RowsCount = rowsCount;
            CellSize = cellSize;
            ControlArea = controlArea;
        }

        public void Update()
        {
            // コントロールの枠を描画
            DX.DrawBox(
                ControlArea.X, ControlArea.Y,
                ControlArea.X + ControlArea.Width, ControlArea.Y + ControlArea.Height,
                DX.GetColor(100, 100, 100),
                0
            );

            // TODO: 描画対象のセルを取得

            // 横線の描画
            for (int i = 0; i <= RowsCount; i++)
            {
                var p1 = new Point(
                    0,
                    CellSize.Height * i);

                var p2 = new Point(
                    RowsCount * CellSize.Width,
                    CellSize.Height * i);

                var vp1 = PointConversion.GlobalToViewport(p1, ViewportOrigin);
                var vp2 = PointConversion.GlobalToViewport(p2, ViewportOrigin);
                vp1.Offset(ControlArea.GetPoint());
                vp2.Offset(ControlArea.GetPoint());

                DX.DrawLine(
                    vp1.X,
                    vp1.Y,
                    vp2.X,
                    vp2.Y,
                    DX.GetColor(150, 150, 150));
            }

            // 縦線の描画
            for (int i = 0; i <= ColumnsCount; i++)
            {
                var p1 = new Point(
                    CellSize.Width * i,
                    0);

                var p2 = new Point(
                    CellSize.Width * i,
                    ColumnsCount * CellSize.Width);

                var vp1 = PointConversion.GlobalToViewport(p1, ViewportOrigin);
                var vp2 = PointConversion.GlobalToViewport(p2, ViewportOrigin);
                vp1.Offset(ControlArea.GetPoint());
                vp2.Offset(ControlArea.GetPoint());

                DX.DrawLine(
                    vp1.X,
                    vp1.Y,
                    vp2.X,
                    vp2.Y,
                    DX.GetColor(150, 150, 150));
            }
        }
    }
}
