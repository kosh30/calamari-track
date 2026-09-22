"""Stand-in for the user's browser during `calamari login` tests.

Invoked through $BROWSER with the authorize URL. It follows the fake
authorization server's redirect to the helper's loopback callback, which is
what a real browser does after the user signs in.
"""

import sys
import urllib.request

urllib.request.urlopen(sys.argv[1], timeout=10).read()
