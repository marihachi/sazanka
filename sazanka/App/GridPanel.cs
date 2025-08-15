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
        /// コントロールが配置される領域
        /// </summary>
        public Rectangle ControlArea { get; set; }

        /// <summary>
        /// 現在表示されている領域の基準点
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
            var frameTopLeft = new Point(ControlArea.X, ControlArea.Y);
            var frameBottomRight = new Point(ControlArea.X + ControlArea.Width, ControlArea.Y + ControlArea.Height);
            DX.DrawBox(
                frameTopLeft.X, frameTopLeft.Y,
                frameBottomRight.X + 1, frameBottomRight.Y + 1,
                DX.GetColor(150, 150, 150),
                0
            );

            // TODO: 描画対象のセルを取得
            // - グローバル座標上の表示範囲を満たすセルの領域を計算したい

            // 横線の描画
            for (int i = 0; i <= RowsCount; i++)
            {
                var left = new Point(
                    0,
                    CellSize.Height * i);

                var right = new Point(
                    RowsCount * CellSize.Width,
                    CellSize.Height * i);

                var vpLeft = PointConversion.GlobalToViewport(left, ViewportOrigin);
                var vpRight = PointConversion.GlobalToViewport(right, ViewportOrigin);
                vpLeft.Offset(ControlArea.GetPoint());
                vpRight.Offset(ControlArea.GetPoint());

                DX.DrawLine(
                    vpLeft.X,
                    vpLeft.Y,
                    vpRight.X,
                    vpRight.Y,
                    DX.GetColor(150, 150, 150));
            }

            // 縦線の描画
            for (int i = 0; i <= ColumnsCount; i++)
            {
                var top = new Point(
                    CellSize.Width * i,
                    0);

                var bottom = new Point(
                    CellSize.Width * i,
                    ColumnsCount * CellSize.Width);

                var vpTop = PointConversion.GlobalToViewport(top, ViewportOrigin);
                var vpBottom = PointConversion.GlobalToViewport(bottom, ViewportOrigin);
                vpTop.Offset(ControlArea.GetPoint());
                vpBottom.Offset(ControlArea.GetPoint());

                DX.DrawLine(
                    vpTop.X,
                    vpTop.Y,
                    vpBottom.X,
                    vpBottom.Y,
                    DX.GetColor(150, 150, 150));
            }
        }
    }
}
