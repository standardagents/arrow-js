import { html } from '@src/index'
import example from './Example'
import ReactiveDataExamples from '../examples/ReactiveDataExamples'

export default function () {
  return html` <h2 id="watching-data">
      Watching data <code>w</code> || <code>watch</code>
    </h2>
    <section>
      <p>
        Arrow has a built in <code>watch</code> function (<code>w</code> for
        shorthand) which performs an important task: it calls a function, tracks
        any reactive data dependencies of that function, and then re-calls that
        function if any of the dependencies change. It's not unlike the file
        watchers employed in many development build tools that update a page
        when you save a file.
      </p>
      <p>
        A watcher can receive any function at all, and that function can use any
        data objects created with the <code>r</code> function. To see this in
        action, let's take a look at the previous example.
      </p>
      ${example(
        ReactiveDataExamples.watcher.code,
        ReactiveDataExamples.watcher.example
      )}
      <p>
        The <code>w</code> function automatically tracks all dependencies used
        by our <code>total()</code> function and turns
        <code>$on</code> observers for those properties. However, the watcher
        also detects when a dependency is no longer being used by a function and
        turns <code>$off</code> tracking for those properties.
      </p>
      <p>
        In our example, this means that when <code>logTotal</code> is
        <code>false</code> it will not call our <code>total()</code> function
        again until <code>data.logTotal</code> is set back to <code>true</code>.
      </p>
      <p>
        You can also pass a second function to the <code>w</code> function that
        serves as a callback for affecting some change. This is called each time
        the watched function is called. Its argument is the value returned by
        the watched function.
      </p>
      <p>
        If we take all of this information and choose to write some concise
        code, we can build expressive and powerful systems with very little
        code. Here is our example written one last time.
      </p>
      ${example(
        ReactiveDataExamples.watcher2.code,
        ReactiveDataExamples.watcher2.example
      )}
    </section>`
}
