import { TokenType } from '../scanner/TokenTypes'
import { Token } from '../scanner/Token'
import {
  BinaryExpr,
  DestructureExpr,
  GroupingExpr,
  IdentifierExpr,
  IExpr,
  LiteralExpr,
  MemlPropertiesExpr,
  UnaryExpr,
} from './Expr'
import { MemlC } from '../core'
import {
  ComponentStmt,
  ExpressionStmt,
  IStmt,
  MemlStmt,
  PageStmt,
} from './Stmt'

export class Parser {
  private tokens: Token[]
  private current: number = 0
  private lastOnError: number

  constructor(tokens: Token[]) {
    this.tokens = tokens
  }

  /**
   * page        = ('(' declaration ')')* EOF;
   */
  parse(): PageStmt {
    let stmts = []

    while (!this.isAtEnd()) {
      stmts.push(this.declaration())
    }

    return new PageStmt(stmts)
  }

  // ===========================================================================
  // This is the parsers logic tree.

  /**
   * declaration = compDecl
   *             | statement;
   */
  private declaration(): IStmt {
    try {
      if (this.doubleCheck(TokenType.COMPONENT)) return this.componentStmt()

      return this.statement()
    } catch (err) {
      this.synchronize()
      return null
    }
  }

  /**
   * statement   = memlStmt
   *             | expression;
   */
  private statement(): IStmt {
    // Check if the next token is an identifier or a tag
    if (
      this.doubleCheck(TokenType.IDENTIFIER) &&
      this.check(TokenType.LEFT_PAREN)
    ) {
      // Then this is a meml tag and should be passed through
      return this.memlStmt()
    }

    // Otherwise it is an expression
    return new ExpressionStmt(this.expression())
  }

  // --------------------------
  // MEML Statements

  private componentStmt(): IStmt {
    this.consume(
      TokenType.LEFT_PAREN,
      'Expected opening bracket before component'
    )
    this.advance()

    // This will be the name of the component
    const identifier = this.advance()
    let props = new DestructureExpr([])

    // Consume the brackets before the props
    this.consume(TokenType.LEFT_PAREN, 'Expected opening bracket before props')
    if (this.check(TokenType.IDENTIFIER)) {
      // Collect the props as a destructure
      props = this.destructure()
    }
    // Consume the parenthesize after the destructure
    this.consume(TokenType.RIGHT_PAREN, 'Expected closing bracket after props')

    // Collect the meml statement
    const memlStmt = this.memlStmt()

    // Consume the ending parenthesis
    this.consume(
      TokenType.RIGHT_PAREN,
      'Expected closing bracket after component'
    )

    return new ComponentStmt(identifier, props, memlStmt)
  }

  /**
   * memlStmt    = IDENTIFIER memlProp* statement*;
   */
  private memlStmt(): IStmt {
    this.consume(
      TokenType.LEFT_PAREN,
      'Expected opening bracket meml statement'
    )

    const identifier = this.advance()
    const props = []
    const children = []

    while (this.match(TokenType.IDENTIFIER)) {
      props.push(this.memlProps())
    }

    while (!this.match(TokenType.RIGHT_PAREN)) {
      children.push(this.statement())
    }

    return new MemlStmt(identifier, props, children)
  }

  /**
   * memlProp    → IDENTIFIER
   *             | IDENTIFIER '=' expression;
   */
  private memlProps(): MemlPropertiesExpr {
    const identifier = this.previous()
    let expression: IExpr = new LiteralExpr('')

    if (this.match(TokenType.EQUAL)) {
      expression = this.expression()
    }

    return new MemlPropertiesExpr(identifier, expression)
  }

  // --------------------------
  // Expression logic

  /**
   * expression  = equality;
   */
  private expression(): IExpr {
    return this.equality()
  }

  /**
   * This is part of a custom implementation of the binary operation. This function
   * is tasked with equality
   *
   * equality    = comparison (('!=' | '==') comparison)*;
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
   * comparison  = term (('>' | '>=' | '<' | '<=') term)*;
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
   * term        = factor (('-' | '+') factor)*;
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
   * factor      = unary (('/' | '*') unary)*;
   */
  private factor(): IExpr {
    let expr = this.unary()

    while (this.match(TokenType.SLASH, TokenType.STAR)) {
      const operator = this.previous()
      const right = this.unary()
      expr = new BinaryExpr(expr, operator, right)
    }

    return expr
  }

  /**
   * unary       = ('!' | '-') unary
   *             | primary;
   */
  private unary(): IExpr {
    if (this.match(TokenType.BANG, TokenType.MINUS)) {
      const operator = this.previous()
      const right = this.unary()
      return new UnaryExpr(operator, right)
    }

    return this.primary()
  }

  /**
   * primary     = NUMBER | STRING | 'true' | 'false' | 'null'
   *             | '(' expression ')';
   */
  private primary(): IExpr {
    if (this.match(TokenType.FALSE)) return new LiteralExpr(false)
    if (this.match(TokenType.TRUE)) return new LiteralExpr(true)
    if (this.match(TokenType.NULL)) return new LiteralExpr(null)

    if (this.match(TokenType.NUMBER, TokenType.STRING)) {
      return new LiteralExpr(this.previous().literal)
    }

    if (this.match(TokenType.LEFT_PAREN)) {
      const expr = this.expression()
      this.consume(TokenType.RIGHT_PAREN, `Expect ')' after expression.`)
      return new GroupingExpr(expr)
    }

    if (this.match(TokenType.IDENTIFIER))
      return new IdentifierExpr(this.previous())

    this.error(this.peek(), 'Expected expression.')
  }

  // --------------------------
  // Other datatypes

  /**
   * destructure = IDENTIFIER ( ',' IDENTIFIER )*;
   */
  private destructure(): DestructureExpr {
    // Consume the first identifier
    const identifiers = [this.advance()]

    // If there is a comma, there will be another identifier
    while (this.peek().type === TokenType.COMMA) {
      // Consume the comma token
      this.advance()
      // Consume the next identifier and add it to the array
      identifiers.push(this.advance())
    }

    return new DestructureExpr(identifiers)
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

  private doubleCheck(type: TokenType): boolean {
    if (this.isAtEnd()) return false
    return this.doublePeek().type === type
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

  private doublePeek(): Token {
    return this.tokens[this.current + 1]
  }

  private previous(): Token {
    return this.tokens[this.current - 1]
  }
}
