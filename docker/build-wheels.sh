#!/bin/bash
set -e

cd /opt/aim

echo "build python wheels"

export PATH=/opt/python/${python_version}/bin:$PATH
echo "build wheels for ${PYTHON_VERSION}"
python -m pip install build
python -m build
pip install dist/*${python_version}*.whl
pip install git+https://github.com/aimhubio/auditwheel.git@include-exclude
export LIB_DIR=`python -c "from aimrocks import lib_utils; print(lib_utils.get_lib_dir())"`
export LIBS_BUNDLED=`ls ${LIB_DIR}/ \
  | grep .so \
  | sed -r 's/^(lib.*?\.so)\.*?$/\1/g' \
  | uniq \
  | paste -s -d','`
export LD_LIBRARY_PATH=$LIB_DIR:$LD_LIBRARY_PATH
auditwheel repair \
  --exclude $LIBS_BUNDLED --wheel-dir multilinux_dist \
  dist/*${python_version}*.whl


echo "python wheels build. SUCCESS"
echo "DONE"