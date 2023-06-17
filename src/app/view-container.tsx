import { useEffect, useLayoutEffect, useState } from 'react';
import './view-container.css';
import { SheetView } from '../sheet-view/view-model.js';

const useWindowSize = (): number[] => {
  const [size, setSize] = useState([0, 0]);
  useLayoutEffect(() => {
    const updateSize = (): void => {
      setSize([window.innerWidth, window.innerHeight]);
    };

    window.addEventListener('resize', updateSize);
    updateSize();

    return () => window.removeEventListener('resize', updateSize);
  }, []);
  return size;
};

function ViewContainer() {
  function contextmenuHandler(e: MouseEvent) {
    e.preventDefault();
  }

  function getCanvas() {
    return document.querySelector<HTMLCanvasElement>('#view');
  }

  const [windowWidth, windowHeight] = useWindowSize();

  useEffect(() => {
    getCanvas()?.addEventListener(`contextmenu`, contextmenuHandler);
    const view = new SheetView();
    view.init();

    return () => {
      view.dispose();
      getCanvas()?.removeEventListener(`contextmenu`, contextmenuHandler);
    };
  }, []);

  return (
    <>
      <canvas
        id='view'
        width={windowWidth - 10}
        height={windowHeight - 10}
      />
    </>
  );
}

export default ViewContainer;
