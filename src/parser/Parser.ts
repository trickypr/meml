import { TokenType } from '../scanner/TokenTypes'
import { Token } from '../scanner/Token'
import {
  BinaryExpr,
  GroupingExpr,
  IExpr,
  LiteralExpr,
  MemlPropertiesExpr,
  UnaryExpr,
} from './Expr'
import { MemlC } from '../core'
import { ExpressionStmt, IStmt, MemlStmt, PageStmt } from './Stmt'

export class Parser {
  private tokens: Token[]
  private current: number = 0
  private lastOnError: number

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  /**
   * page        → statement* EOF;
   */
  parse(): PageStmt {
    let stmts = []

    while (!this.isAtEnd()) {
      stmts.push(this.statement())
    }

    return new PageStmt(stmts)
  }

  // ===========================================================================
  // This is the parsers logic tree.

  /**
   * statement   → memlStmt;
   */
  private statement(): IStmt {
    const expr = this.memlStmt()

    return expr
  }

  // --------------------------
  // MEML Statements

  /**
   * memlStmt    → '(' IDENTIFIER memlProp* exprOrMeml* ')';
   */
  private memlStmt(): IStmt {
    this.consume(
      TokenType.LEFT_PAREN,
      'Expected opening brackets of a meml statement.'
    )

    const identifier = this.advance()
    let props = []
    let children = []

    while (this.match(TokenType.IDENTIFIER)) {
      props.push(this.memlProps())
    }

    while (!this.match(TokenType.RIGHT_PAREN)) {
      children.push(this.exprOrMeml())
    }

    return new MemlStmt(identifier, props, children)
  }

  /**
   * memlProp    → IDENTIFIER
   *             | IDENTIFIER '=' expression;
   */
  private memlProps(): MemlPropertiesExpr {
    const identifier = this.advance()
    let expression: IExpr = new LiteralExpr('')

    if (this.match(TokenType.EQUAL)) {
      expression = this.expression()
    }

    return new MemlPropertiesExpr(identifier, expression)
  }

  // --------------------------
  // Expression statements

  /**
   * exprOrMeml  → memlStmt
   *             | expression;
   */
  private exprOrMeml(): IStmt {
    if (this.peek().type === TokenType.LEFT_PAREN) {
      return this.memlStmt()
    }

    return new ExpressionStmt(this.expression())
  }

  // --------------------------
  // Expression logic

  /**
   * expression  → literal
   *             | unary
   *             | binary
   *             | grouping;
   */
  private expression(): IExpr {
    return this.equality()
  }

  /**
   * This is part of a custom implementation of the binary operation. This function
   * is tasked with equality
   *
   * binary      → expression operator expression;
   */
  private equality(): IExpr {
    let expr = this.comparison()

    while (this.match(TokenType.BANG_EQUAL, TokenType.EQUAL_EQUAL)) {
      const operator = this.previous()
      const right = this.comparison()
      expr = new BinaryExpr(expr, operator, right)
    }

    return expr
  }

  /**
   * This is part of a custom implementation of the binary operation. This function
   * is tasked with comparison
   *
   * binary      → expression operator expression;
   */
  private comparison(): IExpr {
    let expr = this.term()

    while (
      this.match(
        TokenType.GREATER,
        TokenType.GREATER_EQUAL,
        TokenType.LESS,
        TokenType.LESS_EQUAL
      )
    ) {
      const operator = this.previous()
      const right = this.term()
      expr = new BinaryExpr(expr, operator, right)
    }

    return expr
  }

  /**
   * This is part of a custom implementation of the binary operation. This function
   * is tasked with terms
   *
   * binary      → expression operator expression;
   */
  private term(): IExpr {
    let expr = this.factor()

    while (this.match(TokenType.PLUS, TokenType.MINUS)) {
      const operator = this.previous()
      const right = this.factor()
      expr = new BinaryExpr(expr, operator, right)
    }

    return expr
  }

  /**
   * This is part of a custom implementation of the binary operation. This function
   * is tasked with factors
   *
   * binary      → expression operator expression;
   */
  private factor(): IExpr {
    const left = this.unary()
    let expr

    while (this.match(TokenType.SLASH, TokenType.STAR)) {
      const operator = this.previous()
      const right = this.unary()
      expr = new BinaryExpr(left, operator, right)
    }

    return expr as IExpr
  }

  /**
   * unary       → ('-' | '!') expression;
   */
  private unary(): IExpr {
    if (this.match(TokenType.BANG, TokenType.MINUS)) {
      const operator = this.previous()
      const right = this.unary()
      return new UnaryExpr(operator, right)
    }

    return this.literal()
  }

  /**
   * literal     → NUMBER
   *             | STRING
   *             | 'true'
   *             | 'false'
   *             | 'null';
   */
  private literal(): IExpr {
    if (this.match(TokenType.FALSE)) return new LiteralExpr(false)
    if (this.match(TokenType.TRUE)) return new LiteralExpr(true)
    if (this.match(TokenType.NULL)) return new LiteralExpr(null)

    if (this.match(TokenType.NUMBER, TokenType.STRING)) {
      return new LiteralExpr(this.previous().literal)
    }

    return this.grouping()
  }

  private grouping(): IExpr {
    if (this.match(TokenType.LEFT_PAREN)) {
      const expr = this.expression()
      this.consume(TokenType.RIGHT_PAREN, `Expect ')' after expression.`)
      return new GroupingExpr(expr)
    }

    // if (this.lastOnError && this.lastOnError == this.current) {
    //   MemlC.errorAtToken(
    //     this.advance(),
    //     'Recursion has occurred, skipping token.'
    //   )
    // } else {
    //   this.lastOnError = this.current
    // }

    this.error(this.peek(), 'Expected expression.')

    return this.unary()
  }

  // ===========================================================================
  // Utilities
  private match(...types: TokenType[]): boolean {
    for (let i = 0; i < types.length; i++) {
      const type = types[i]

      if (this.check(type)) {
        this.advance()
        return true
      }
    }

    return false
  }

  private consume(token: TokenType, message: string): Token {
    if (this.check(token)) return this.advance()

    this.error(this.peek(), message)
  }

  private synchronize() {
    this.advance()

    while (!this.isAtEnd()) {
      if (this.previous().type === TokenType.RIGHT_PAREN) return

      switch (this.peek().type) {
        case TokenType.TAG:
          return
      }

      this.advance()
    }
  }

  private error(token: Token, message: string) {
    MemlC.errorAtToken(token, message)
  }

  private check(type: TokenType): boolean {
    if (this.isAtEnd()) return false
    return this.peek().type === type
  }

  private advance(): Token {
    if (!this.isAtEnd()) this.current++
    return this.previous()
  }

  private isAtEnd(): boolean {
    return this.peek().type === TokenType.EOF
  }

  private peek(): Token {
    return this.tokens[this.current]
  }

  private previous(): Token {
    return this.tokens[this.current - 1]
  }
}
