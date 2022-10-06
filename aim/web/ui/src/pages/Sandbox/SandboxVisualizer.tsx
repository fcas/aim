import * as React from 'react';
import classnames from 'classnames';

import Editor from '@monaco-editor/react';

import { Button, Spinner } from 'components/kit';

import { AlignmentOptionsEnum } from 'utils/d3';
import { filterMetricsData } from 'utils/filterMetricData';

import { initialCode } from './sandboxCode';
import { dataVizElementsMap } from './dataVizElementsMap';

import './SandboxVisualizer.scss';

export default function SandboxVisualizer(props: any) {
  const {
    engine: { useStore, pipeline },
  } = props;

  const data = useStore(pipeline.dataSelector)?.map((item: any) => {
    const { values, steps, epochs, timestamps } = filterMetricsData(
      item.data,
      AlignmentOptionsEnum.STEP,
    );
    return {
      name: item.data.name,
      context: item.data.context,
      values: [...values],
      steps: [...steps],
      epochs: [...epochs],
      timestamps: [...timestamps],
      run: item.run,
    };
  });

  (window as any).metrics = data;
  const pyodide = React.useRef<any>();

  const editorValue = React.useRef(initialCode);
  const [result, setResult] = React.useState<Record<string, any>>({});
  const [isProcessing, setIsProcessing] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    async function main() {
      pyodide.current = await (window as any).loadPyodide({
        stdout: (...args: any[]) => {
          window.requestAnimationFrame(() => {
            const terminal = document.getElementById('console');
            if (terminal) {
              terminal.innerHTML! += `<p>>>> ${args.join(', ')}</p>`;
              terminal.scrollTop = terminal.scrollHeight;
            }
          });
        },
      });

      execute();
    }
    main();
  }, []);

  const execute = React.useCallback(async () => {
    function toObject(x: any): any {
      if (x instanceof Map) {
        return Object.fromEntries(
          Array.from(x.entries(), ([k, v]) => [k, toObject(v)]),
        );
      } else if (x instanceof Array) {
        return x.map(toObject);
      } else {
        return x;
      }
    }
    try {
      setIsProcessing(true);
      const code = editorValue.current.replace('aim-ui-client', 'js');
      await pyodide.current!.loadPackagesFromImports(code);
      pyodide.current!.runPythonAsync(code).then(() => {
        const layout = pyodide.current.globals.get('layout');
        if (layout) {
          const resultData = pyodide.current.globals.get('layout').toJs();
          const convertedResult = toObject(resultData);
          setResult(convertedResult);
        }
        setIsProcessing(false);
      });
    } catch (ex) {
      console.log(ex);
    }
  }, [editorValue]);

  return (
    <div className='SandboxVisualizer'>
      <div className='SandboxVisualizer__panel'>
        <Button
          color='primary'
          variant='contained'
          size='small'
          onClick={execute}
        >
          Run
        </Button>
      </div>
      <div className='SandboxVisualizer__main'>
        <div className='SandboxVisualizer__main__editor'>
          <Editor
            language='python'
            height='100%'
            value={editorValue.current}
            onChange={(v) => (editorValue.current = v!)}
            loading={<span />}
          />
        </div>
        <div
          className={classnames('SandboxVisualizer__main__components', {
            'SandboxVisualizer__main__components--loading':
              isProcessing === null,
            'SandboxVisualizer__main__components--processing': isProcessing,
          })}
        >
          {isProcessing !== false && (
            <div className='SandboxVisualizer__main__components__spinner'>
              <Spinner />
            </div>
          )}
          <div
            key={`${isProcessing}`}
            className='SandboxVisualizer__main__components__viz'
          >
            {Object.keys(result).map((vizType) => (
              <div
                key={vizType}
                style={{
                  flex: 1,
                  minHeight: '50%',
                  boxShadow: '0 0 0 1px #b5b9c5',
                }}
              >
                {dataVizElementsMap[vizType as 'linechart' | 'dataframe'](
                  result[vizType],
                )}
              </div>
            ))}
          </div>
          <pre
            id='console'
            className='SandboxVisualizer__main__components__console'
          />
        </div>
      </div>
    </div>
  );
}
